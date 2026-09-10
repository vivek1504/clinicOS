import { Elysia } from "elysia";
import { AppointmentService } from "../services/appointment.service";
import {
  AppointmentDto,
  GetAppointmentsQuery,
  PatchAppointmentStatusBody,
} from "../schemas/appointment";
import { IdParams, ErrorEnvelope } from "../schemas/common";
import { t } from "elysia";

export const appointmentRoutes = new Elysia({ prefix: "/appointments" })
  .decorate("appointmentService", new AppointmentService())
  .get(
    "",
    async ({ query, appointmentService }) => {
      return await appointmentService.listAppointments(query.date);
    },
    {
      query: GetAppointmentsQuery,
      response: {
        200: t.Array(AppointmentDto),
        400: ErrorEnvelope,
      },
    }
  )
  .patch(
    "/:id",
    async ({ params, body, appointmentService }) => {
      return await appointmentService.patchStatus(params.id, body.status);
    },
    {
      params: IdParams,
      body: PatchAppointmentStatusBody,
      response: {
        200: AppointmentDto,
        400: ErrorEnvelope,
        404: ErrorEnvelope,
        409: ErrorEnvelope,
      },
    }
  );
