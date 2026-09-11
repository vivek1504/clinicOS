import { apiFetch } from "./client";
import type { ConsultationDto, PatientDto, PatientInput } from "./types";

export function getPatient(id: string) {
  return apiFetch<PatientDto>(`/patients/${encodeURIComponent(id)}`);
}

export function getPatientConsultations(id: string) {
  return apiFetch<ConsultationDto[]>(`/patients/${encodeURIComponent(id)}/consultations`);
}

export function createPatient(body: PatientInput & { allowDuplicate?: boolean }) {
  return apiFetch<PatientDto>("/patients", { method: "POST", body: JSON.stringify(body) });
}

export function updatePatient(id: string, body: Partial<PatientInput>) {
  return apiFetch<PatientDto>(`/patients/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function getPatients(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<PatientDto[]>(`/patients${qs}`);
}
