import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { getAge } from "../lib/dates";
import { Gender, Prisma } from "@prisma/client";

const isUniqueViolation = (err: unknown): err is Prisma.PrismaClientKnownRequestError =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

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

export interface PatientInput {
  name: string;
  dob: string; // YYYY-MM-DD
  gender: Gender;
  phone: string;
  allergies?: string[];
  conditions?: string[];
}

const toDto = (p: { id: string; name: string; dob: Date; gender: Gender; phone: string; allergies: string[]; conditions: string[] }): PatientDtoType => ({
  id: p.id,
  name: p.name,
  dob: p.dob.toISOString().slice(0, 10),
  age: getAge(p.dob),
  gender: p.gender,
  phone: p.phone,
  allergies: p.allergies,
  conditions: p.conditions,
});

const digits = (phone: string) => phone.replace(/\D/g, "");
const cleanList = (xs?: string[]) => xs?.map((x) => x.trim()).filter(Boolean);

const parseDob = (dob: string): Date => {
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d > new Date()) throw new AppError("VALIDATION", "Date of birth is not a valid past date");
  return d;
};

export class PatientService {
  /** Name or phone search; phone matches on digits so "555 0101" finds "+1-555-0101". */
  async listPatients(query?: string): Promise<PatientDtoType[]> {
    const q = query?.trim();
    const qDigits = q ? digits(q) : "";
    const patients = await prisma.patient.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(qDigits.length >= 3 ? [{ phone: { contains: qDigits.slice(-4) } }] : [])] }
        : undefined,
      take: 25,
      orderBy: { name: "asc" },
    });
    return patients.filter((p) => !qDigits || qDigits.length < 3 || p.name.toLowerCase().includes(q!.toLowerCase()) || digits(p.phone).includes(qDigits)).map(toDto);
  }

  async getPatientById(id: string): Promise<PatientDtoType> {
    const p = await prisma.patient.findUnique({ where: { id } });
    if (!p) throw new AppError("NOT_FOUND", `Patient not found: ${id}`);
    return toDto(p);
  }

  /** The unique index fired: name the patient who holds the number so the desk can open them instead. */
  private async phoneTaken(phone: string): Promise<never> {
    const existing = await prisma.patient.findUnique({ where: { phone }, select: { id: true, name: true } });
    throw new AppError("CONFLICT", `${existing?.name ?? "Someone"} is already registered with this phone number`, { patientId: existing?.id, name: existing?.name });
  }

  /** One record per phone number, enforced by the database; the message names the existing patient. */
  async create(input: PatientInput): Promise<PatientDtoType> {
    const phone = input.phone.trim();
    try {
      const p = await prisma.patient.create({
        data: {
          name: input.name.trim(),
          dob: parseDob(input.dob),
          gender: input.gender,
          phone,
          allergies: cleanList(input.allergies) ?? [],
          conditions: cleanList(input.conditions) ?? [],
        },
      });
      return toDto(p);
    } catch (err) {
      if (isUniqueViolation(err)) return this.phoneTaken(phone);
      throw err;
    }
  }

  async update(id: string, patch: Partial<PatientInput>): Promise<PatientDtoType> {
    const exists = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError("NOT_FOUND", `Patient not found: ${id}`);
    try {
      const p = await prisma.patient.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
          ...(patch.dob !== undefined ? { dob: parseDob(patch.dob) } : {}),
          ...(patch.gender !== undefined ? { gender: patch.gender } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
          ...(patch.allergies !== undefined ? { allergies: cleanList(patch.allergies) } : {}),
          ...(patch.conditions !== undefined ? { conditions: cleanList(patch.conditions) } : {}),
        },
      });
      return toDto(p);
    } catch (err) {
      if (isUniqueViolation(err) && patch.phone !== undefined) return this.phoneTaken(patch.phone.trim());
      throw err;
    }
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
