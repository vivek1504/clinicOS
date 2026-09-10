import { apiFetch } from "./client";
import type { ConsultationDto, CreateConsultationBody } from "./types";

export function createConsultation(body: CreateConsultationBody) {
  return apiFetch<ConsultationDto>("/consultations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
