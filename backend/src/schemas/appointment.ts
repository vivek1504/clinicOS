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
  consultation: t.Optional(t.Nullable(t.Object({ id: t.String() }))),
});

export const GetAppointmentsQuery = t.Object({
  date: t.Optional(t.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
});

export const PatchAppointmentStatusBody = t.Object({
  status: t.Enum(AppointmentStatus),
});
