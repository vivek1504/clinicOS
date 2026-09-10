export type AppointmentStatus = "WAITING" | "IN_CONSULTATION" | "COMPLETED";
export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface AppointmentDto {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  reason: string;
  status: AppointmentStatus;
  patient: { id: string; name: string };
  consultation?: { id: string } | null;
}

export interface PatientDto {
  id: string;
  name: string;
  dob: string;
  age: number;
  gender: Gender;
  phone: string;
  allergies: string[];
  conditions: string[];
}

export interface StructuredNote {
  chiefComplaint: string | null;
  symptoms: string[];
  relevantHistory: string[];
  medicationsMentioned: string[];
  doctorPlan: string[];
  missingInformation: string[];
}

export type NoteListField = Exclude<keyof StructuredNote, "chiefComplaint">;

export interface ConsultationDto {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string | null;
  clientRequestId: string | null;
  createdAt: string;
  rawNotes: string;
  aiDraft: StructuredNote | null;
  finalNote: StructuredNote;
  aiModel: string | null;
  aiLatencyMs: number | null;
  wasAiUsed: boolean;
  wasAiEdited: boolean;
  chiefComplaint?: string | null;
}

export interface CreateConsultationBody {
  patientId: string;
  appointmentId?: string;
  clientRequestId: string;
  rawNotes: string;
  aiDraft: StructuredNote | null;
  finalNote: StructuredNote;
  aiModel?: string;
  aiLatencyMs?: number;
  wasAiUsed: boolean;
  wasAiEdited: boolean;
}

export interface AiStructureResponse {
  draft: StructuredNote;
  model: string;
  latencyMs: number;
}

export interface ErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}
