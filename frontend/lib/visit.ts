import type { AppointmentDto } from "./api/types";

/**
 * Today's visit for one patient, read from appointment status only, the same source the dashboard uses,
 * so the schedule and the record can never disagree.
 * - `recorded`: the appointment this visit would attach to is already COMPLETED.
 * - `blockedBy`: who must finish first. Whoever is in the room, else the earliest unfinished appointment
 *   booked before this one. Mirrors the backend's queue rule; the backend still has the final say.
 * Walk-ins with no appointment are never blocked here.
 */
export function todaysVisit({
  patientId,
  appointmentId,
  appointments,
}: {
  patientId: string;
  appointmentId?: string;
  appointments: AppointmentDto[];
}): { recorded: boolean; appointment: AppointmentDto | null; blockedBy: AppointmentDto | null } {
  const mine = appointments.filter((a) => a.patientId === patientId);
  const picked = mine.find((a) => a.id === appointmentId) ?? mine.find((a) => a.status !== "COMPLETED" && a.status !== "CANCELLED") ?? mine[0] ?? null;
  const appointment = picked?.status === "CANCELLED" ? null : picked; // a cancelled booking is no booking
  return { recorded: appointment?.status === "COMPLETED", appointment, blockedBy: blockerFor(appointment, appointments) };
}

/** Same rule, for any row on the schedule. Only WAITING and IN_CONSULTATION block; BOOKED (not checked in) does not. */
export function blockerFor(appointment: AppointmentDto | null, appointments: AppointmentDto[]): AppointmentDto | null {
  if (!appointment || !["BOOKED", "WAITING", "NO_SHOW"].includes(appointment.status)) return null;
  const others = appointments.filter((a) => a.id !== appointment.id && (a.status === "WAITING" || a.status === "IN_CONSULTATION"));
  return (
    others.find((a) => a.status === "IN_CONSULTATION") ??
    others.filter((a) => a.scheduledAt < appointment.scheduledAt).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ??
    null
  );
}
