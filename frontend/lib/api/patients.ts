import { apiFetch } from "./client";
import type { ConsultationDto, PatientDto } from "./types";

export function getPatient(id: string) {
  return apiFetch<PatientDto>(`/patients/${encodeURIComponent(id)}`);
}

export function getPatientConsultations(id: string) {
  return apiFetch<ConsultationDto[]>(`/patients/${encodeURIComponent(id)}/consultations`);
}

export function getPatients(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return apiFetch<PatientDto[]>(`/patients${qs}`);
}
