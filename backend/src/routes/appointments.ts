import { Elysia, t } from "elysia";
import { AppointmentService } from "../services/appointment.service";
import { AppointmentDto, CreateAppointmentBody, GetAppointmentsQuery, PatchAppointmentBody } from "../schemas/appointment";
import { IdParams, ErrorEnvelope } from "../schemas/common";
import { AppError } from "../lib/errors";
import { sessionPlugin } from "../auth";

export const appointmentRoutes = new Elysia({ prefix: "/appointments" })
  .use(sessionPlugin)
  .decorate("appointmentService", new AppointmentService())
  .get(
    "",
    async ({ query, appointmentService }) => appointmentService.listAppointments(query.date, query.patientId),
    { query: GetAppointmentsQuery, response: { 200: t.Array(AppointmentDto), 400: ErrorEnvelope } }
  )
  .post(
    "",
    async ({ body, set, appointmentService }) => {
      set.status = 201;
      return await appointmentService.create(body);
    },
    { body: CreateAppointmentBody, response: { 201: AppointmentDto, 400: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope } }
  )
  .patch(
    "/:id",
    async ({ params, body, appointmentService, doctor }) => {
      if (body.status) return await appointmentService.patchStatus(params.id, body.status, doctor!);
      if (body.scheduledAt || body.reason) return await appointmentService.reschedule(params.id, body, doctor!);
      throw new AppError("VALIDATION", "Nothing to change");
    },
    {
      params: IdParams,
      body: PatchAppointmentBody,
      response: { 200: AppointmentDto, 400: ErrorEnvelope, 403: ErrorEnvelope, 404: ErrorEnvelope, 409: ErrorEnvelope },
    }
  );
