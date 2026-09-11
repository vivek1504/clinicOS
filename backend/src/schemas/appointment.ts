import { t } from "elysia";
import { AppointmentStatus } from "@prisma/client";

export { AppointmentStatus };

export const AppointmentDto = t.Object({
  id: t.String(),
  patientId: t.String(),
  doctorId: t.String(),
  scheduledAt: t.String(),
  reason: t.String(),
  status: t.Enum(AppointmentStatus),
  patient: t.Object({
    id: t.String(),
    name: t.String(),
  }),
  doctor: t.Object({ id: t.String(), name: t.String() }),
  consultation: t.Optional(t.Nullable(t.Object({ id: t.String() }))),
});

export const CreateAppointmentBody = t.Object({
  patientId: t.String({ minLength: 1 }),
  doctorId: t.String({ minLength: 1 }),
  scheduledAt: t.String({ format: "date-time" }),
  reason: t.String({ minLength: 1, maxLength: 300 }),
  /** WAITING for a walk-in who is already here; BOOKED (default) otherwise. */
  status: t.Optional(t.Union([t.Literal("BOOKED"), t.Literal("WAITING")])),
});

export const GetAppointmentsQuery = t.Object({
  date: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  /** With a patientId the day window is ignored: every appointment for that patient, newest first. */
  patientId: t.Optional(t.String()),
});

/** Either a status change, or a reschedule (time and/or reason). At least one field. */
export const PatchAppointmentBody = t.Object({
  status: t.Optional(t.Enum(AppointmentStatus)),
  scheduledAt: t.Optional(t.String({ format: "date-time" })),
  reason: t.Optional(t.String({ minLength: 1, maxLength: 300 })),
});
