import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { assertCanStart, assertOwnsAppointment } from "./queue";
import { normalizeNote, deepEqual } from "../ai/normalize";
import type { StructuredNoteType } from "../ai/schema";
import { Prisma, type AppointmentStatus, type Consultation } from "@prisma/client";

const isUniqueViolation = (err: unknown): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

export interface CreateConsultationInput {
  patientId: string;
  appointmentId?: string;
  clientRequestId: string;
  rawNotes: string;
  aiDraft: StructuredNoteType | null;
  finalNote: StructuredNoteType;
  aiModel?: string;
  aiLatencyMs?: number;
  wasAiUsed: boolean;
  wasAiEdited: boolean;
}

export interface ConsultationDtoType {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  clientRequestId: string | null;
  createdAt: string;
  rawNotes: string;
  aiDraft: StructuredNoteType | null;
  finalNote: StructuredNoteType;
  aiModel: string | null;
  aiLatencyMs: number | null;
  wasAiUsed: boolean;
  wasAiEdited: boolean;
  chiefComplaint?: string | null;
}

/** Prisma types the JSON columns as JsonValue; every note in them went through normalizeNote on the way in. */
const asNote = (json: Prisma.JsonValue | null) => json as unknown as StructuredNoteType | null;

export function toConsultationDto(row: Consultation): ConsultationDtoType {
  const finalNote = asNote(row.finalNote)!;
  return {
    id: row.id,
    patientId: row.patientId,
    doctorId: row.doctorId,
    appointmentId: row.appointmentId,
    clientRequestId: row.clientRequestId,
    createdAt: row.createdAt.toISOString(),
    rawNotes: row.rawNotes,
    aiDraft: asNote(row.aiDraft),
    finalNote,
    aiModel: row.aiModel,
    aiLatencyMs: row.aiLatencyMs,
    wasAiUsed: row.wasAiUsed,
    wasAiEdited: row.wasAiEdited,
    chiefComplaint: finalNote.chiefComplaint ?? null,
  };
}

export class ConsultationService {
  /** A retried request gets its original result back. The same key with different content is a client bug, not a retry. */
  private replay(existing: Consultation, data: CreateConsultationInput) {
    const same = existing.patientId === data.patientId && existing.rawNotes === data.rawNotes && deepEqual(existing.finalNote, normalizeNote(data.finalNote));
    if (!same) throw new AppError("CONFLICT", "This clientRequestId was already used for a different consultation");
    return { status: 200 as const, consultation: toConsultationDto(existing) };
  }

  async create(data: CreateConsultationInput, doctorId: string): Promise<{ status: 200 | 201; consultation: ConsultationDtoType }> {
    try {
      return await this.createOnce(data, doctorId);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Two identical requests raced: the loser's insert hit a unique index. Serve it the winner's row.
      const existing = await prisma.consultation.findUnique({ where: { clientRequestId: data.clientRequestId } });
      if (existing) return this.replay(existing, data);
      throw new AppError("CONFLICT", `Appointment ${data.appointmentId} already has a consultation`);
    }
  }

  private async createOnce(data: CreateConsultationInput, doctorId: string): Promise<{ status: 200 | 201; consultation: ConsultationDtoType }> {
    return await prisma.$transaction(async (tx) => {
      // 1. Check idempotency by clientRequestId
      const existingReq = await tx.consultation.findUnique({
        where: { clientRequestId: data.clientRequestId },
      });
      if (existingReq) return this.replay(existingReq, data);

      // 2. Verify patient exists
      const patient = await tx.patient.findUnique({
        where: { id: data.patientId },
      });
      if (!patient) {
        throw new AppError("NOT_FOUND", `Patient not found: ${data.patientId}`);
      }

      // If appointmentId given, verify it belongs to patient and has no consultation
      let apptStatus: AppointmentStatus | undefined;
      if (data.appointmentId) {
        const appt = await tx.appointment.findUnique({
          where: { id: data.appointmentId },
        });
        if (!appt) {
          throw new AppError("VALIDATION", `Appointment not found: ${data.appointmentId}`);
        }
        if (appt.patientId !== data.patientId) {
          throw new AppError(
            "VALIDATION",
            `Appointment ${data.appointmentId} does not belong to patient ${data.patientId}`
          );
        }
        assertOwnsAppointment({ id: doctorId, role: "DOCTOR" }, appt);

        const existingApptConsultation = await tx.consultation.findUnique({
          where: { appointmentId: data.appointmentId },
        });
        if (existingApptConsultation) {
          throw new AppError("CONFLICT", `Appointment ${data.appointmentId} already has a consultation`);
        }

        if (appt.status === "CANCELLED") {
          throw new AppError("CONFLICT", `Appointment ${data.appointmentId} was cancelled`);
        }
        // Skipping straight to COMPLETED still has to respect the room and the queue.
        if (appt.status !== "IN_CONSULTATION") await assertCanStart(tx, appt);
        apptStatus = appt.status;
      }

      // 3. Normalize finalNote and aiDraft
      const normalizedFinal = normalizeNote(data.finalNote);
      const normalizedDraft = data.aiDraft ? normalizeNote(data.aiDraft) : null;

      // 4. Determine wasAiEdited: force true if aiDraft is present and differs from finalNote
      let wasAiEdited = data.wasAiEdited;
      if (normalizedDraft) {
        if (!deepEqual(normalizedDraft, normalizedFinal)) {
          wasAiEdited = true;
        }
      } else {
        wasAiEdited = false;
      }

      // 5. Create consultation. Provenance is derived from what was sent, never from what the client claims:
      //    AI was used iff a draft is attached, and model/latency only mean anything alongside that draft.
      const created = await tx.consultation.create({
        data: {
          patientId: data.patientId,
          doctorId,
          appointmentId: data.appointmentId ?? null,
          clientRequestId: data.clientRequestId,
          rawNotes: data.rawNotes,
          aiDraft: normalizedDraft ? (normalizedDraft as Prisma.InputJsonObject) : undefined,
          finalNote: normalizedFinal as Prisma.InputJsonObject,
          aiModel: normalizedDraft ? (data.aiModel ?? null) : null,
          aiLatencyMs: normalizedDraft ? (data.aiLatencyMs ?? null) : null,
          wasAiUsed: normalizedDraft !== null,
          wasAiEdited,
        },
      });

      // 6. Complete the appointment, but only if it is still in the state read above: a cancel or no-show that
      //    landed meanwhile must not be overwritten by COMPLETED.
      if (data.appointmentId && apptStatus) {
        const { count } = await tx.appointment.updateMany({
          where: { id: data.appointmentId, status: apptStatus },
          data: { status: "COMPLETED" },
        });
        if (count !== 1) throw new AppError("CONFLICT", `Appointment ${data.appointmentId} was changed by someone else; reload and try again`);
      }

      return { status: 201, consultation: toConsultationDto(created) };
    });
  }

  /** Only the doctor who wrote a consultation can change it. Another doctor's record answers 404, not 403: existence is not theirs to learn. */
  async patch(
    id: string,
    data: { finalNote?: StructuredNoteType; rawNotes?: string },
    doctorId: string
  ): Promise<ConsultationDtoType> {
    const existing = await prisma.consultation.findFirst({ where: { id, doctorId } });

    if (!existing) {
      throw new AppError("NOT_FOUND", `Consultation not found: ${id}`);
    }

    const updateData: Prisma.ConsultationUpdateInput = {};

    if (data.rawNotes !== undefined) {
      updateData.rawNotes = data.rawNotes;
    }

    if (data.finalNote !== undefined) {
      const normalizedFinal = normalizeNote(data.finalNote);
      updateData.finalNote = normalizedFinal as Prisma.InputJsonObject;

      let wasAiEdited = existing.wasAiEdited;
      if (existing.aiDraft) {
        if (!deepEqual(existing.aiDraft, normalizedFinal)) {
          wasAiEdited = true;
        }
      }
      updateData.wasAiEdited = wasAiEdited;
    }

    const updated = await prisma.consultation.update({
      where: { id },
      data: updateData,
    });

    return toConsultationDto(updated);
  }
}
