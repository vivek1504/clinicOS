import { apiFetch } from "./client";
import type { AppointmentDto, AppointmentStatus } from "./types";

/** Omit `date` to let the backend resolve "today" in its own timezone. */
export function getAppointments(date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<AppointmentDto[]>(`/appointments${qs}`);
}

/** Every appointment for one patient, newest first. Ignores the day window. */
export function getPatientAppointments(patientId: string) {
  return apiFetch<AppointmentDto[]>(`/appointments?patientId=${encodeURIComponent(patientId)}`);
}

export function createAppointment(body: { patientId: string; doctorId: string; scheduledAt: string; reason: string; status?: "BOOKED" | "WAITING" }) {
  return apiFetch<AppointmentDto>("/appointments", { method: "POST", body: JSON.stringify(body) });
}

export function rescheduleAppointment(id: string, body: { scheduledAt?: string; reason?: string }) {
  return apiFetch<AppointmentDto>(`/appointments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function getDoctors() {
  return apiFetch<{ id: string; name: string }[]>("/doctors");
}

export function patchAppointmentStatus(id: string, status: AppointmentStatus) {
  return apiFetch<AppointmentDto>(`/appointments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
