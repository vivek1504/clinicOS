import { apiFetch } from "./client";
import type { AppointmentDto, AppointmentStatus } from "./types";

/** Omit `date` to let the backend resolve "today" in its own timezone. */
export function getAppointments(date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<AppointmentDto[]>(`/appointments${qs}`);
}

export function patchAppointmentStatus(id: string, status: AppointmentStatus) {
  return apiFetch<AppointmentDto>(`/appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
