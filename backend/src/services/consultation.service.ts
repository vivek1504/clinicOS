import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { normalizeNote, deepEqual } from "../ai/normalize";
import type { StructuredNoteType } from "../ai/schema";

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

function toDto(row: any): ConsultationDtoType {
  const finalObj = row.finalNote as Record<string, any> | null;
  const chiefComplaint =
    typeof finalObj?.chiefComplaint === "string" ? finalObj.chiefComplaint : null;

  return {
    id: row.id,
    patientId: row.patientId,
    doctorId: row.doctorId,
    appointmentId: row.appointmentId,
    clientRequestId: row.clientRequestId,
    createdAt: row.createdAt.toISOString(),
    rawNotes: row.rawNotes,
    aiDraft: row.aiDraft as StructuredNoteType | null,
    finalNote: row.finalNote as StructuredNoteType,
    aiModel: row.aiModel,
    aiLatencyMs: row.aiLatencyMs,
    wasAiUsed: row.wasAiUsed,
    wasAiEdited: row.wasAiEdited,
    chiefComplaint,
  };
}

export class ConsultationService {
  async create(data: CreateConsultationInput, doctorId: string): Promise<{ status: 200 | 201; consultation: ConsultationDtoType }> {
    return await prisma.$transaction(async (tx) => {
      // 1. Check idempotency by clientRequestId
      const existingReq = await tx.consultation.findUnique({
        where: { clientRequestId: data.clientRequestId },
      });
      if (existingReq) {
        return { status: 200, consultation: toDto(existingReq) };
      }

      // 2. Verify patient exists
      const patient = await tx.patient.findUnique({
        where: { id: data.patientId },
      });
      if (!patient) {
        throw new AppError("NOT_FOUND", `Patient not found: ${data.patientId}`);
      }

      // If appointmentId given, verify it belongs to patient and has no consultation
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

        const existingApptConsultation = await tx.consultation.findUnique({
          where: { appointmentId: data.appointmentId },
        });
        if (existingApptConsultation) {
          throw new AppError("CONFLICT", `Appointment ${data.appointmentId} already has a consultation`);
        }
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

      // 5. Create consultation
      const created = await tx.consultation.create({
        data: {
          patientId: data.patientId,
          doctorId,
          appointmentId: data.appointmentId ?? null,
          clientRequestId: data.clientRequestId,
          rawNotes: data.rawNotes,
          aiDraft: normalizedDraft ? (normalizedDraft as any) : undefined,
          finalNote: normalizedFinal as any,
          aiModel: data.aiModel ?? null,
          aiLatencyMs: data.aiLatencyMs ?? null,
          wasAiUsed: data.wasAiUsed,
          wasAiEdited,
        },
      });

      // 6. Update appointment to COMPLETED if appointmentId present
      if (data.appointmentId) {
        await tx.appointment.update({
          where: { id: data.appointmentId },
          data: { status: "COMPLETED" },
        });
      }

      return { status: 201, consultation: toDto(created) };
    });
  }

  async patch(
    id: string,
    data: { finalNote?: StructuredNoteType; rawNotes?: string }
  ): Promise<ConsultationDtoType> {
    const existing = await prisma.consultation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError("NOT_FOUND", `Consultation not found: ${id}`);
    }

    const updateData: any = {};

    if (data.rawNotes !== undefined) {
      updateData.rawNotes = data.rawNotes;
    }

    if (data.finalNote !== undefined) {
      const normalizedFinal = normalizeNote(data.finalNote);
      updateData.finalNote = normalizedFinal;

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

    return toDto(updated);
  }
}
