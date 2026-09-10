import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { getAge } from "../lib/dates";
import { Gender } from "../generated/prisma/enums";

export interface PatientDtoType {
  id: string;
  name: string;
  dob: string;
  age: number;
  gender: Gender;
  phone: string;
  allergies: string[];
  conditions: string[];
}

export interface PatientConsultationItemDto {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  clientRequestId: string | null;
  createdAt: string;
  chiefComplaint: string | null;
  rawNotes: string;
  aiDraft: any | null;
  finalNote: any;
  aiModel: string | null;
  aiLatencyMs: number | null;
  wasAiUsed: boolean;
  wasAiEdited: boolean;
}

export class PatientService {
  async listPatients(query?: string): Promise<PatientDtoType[]> {
    const q = query?.trim();

    const patients = await prisma.patient.findMany({
      where: q
        ? {
            name: {
              contains: q,
              mode: "insensitive",
            },
          }
        : undefined,
      take: 25,
      orderBy: { name: "asc" },
    });

    return patients.map((p) => ({
      id: p.id,
      name: p.name,
      dob: p.dob.toISOString().slice(0, 10),
      age: getAge(p.dob),
      gender: p.gender as Gender,
      phone: p.phone,
      allergies: p.allergies,
      conditions: p.conditions,
    }));
  }

  async getPatientById(id: string): Promise<PatientDtoType> {
    const p = await prisma.patient.findUnique({
      where: { id },
    });

    if (!p) {
      throw new AppError("NOT_FOUND", `Patient not found: ${id}`);
    }

    return {
      id: p.id,
      name: p.name,
      dob: p.dob.toISOString().slice(0, 10),
      age: getAge(p.dob),
      gender: p.gender as Gender,
      phone: p.phone,
      allergies: p.allergies,
      conditions: p.conditions,
    };
  }

  async getConsultationsByPatientId(patientId: string): Promise<PatientConsultationItemDto[]> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new AppError("NOT_FOUND", `Patient not found: ${patientId}`);
    }

    const consultations = await prisma.consultation.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });

    return consultations.map((c) => {
      const finalObj = c.finalNote as Record<string, any> | null;
      const chiefComplaint =
        typeof finalObj?.chiefComplaint === "string" ? finalObj.chiefComplaint : null;

      return {
        id: c.id,
        patientId: c.patientId,
        doctorId: c.doctorId,
        appointmentId: c.appointmentId,
        clientRequestId: c.clientRequestId,
        createdAt: c.createdAt.toISOString(),
        chiefComplaint,
        rawNotes: c.rawNotes,
        aiDraft: c.aiDraft,
        finalNote: c.finalNote,
        aiModel: c.aiModel,
        aiLatencyMs: c.aiLatencyMs,
        wasAiUsed: c.wasAiUsed,
        wasAiEdited: c.wasAiEdited,
      };
    });
  }
}
