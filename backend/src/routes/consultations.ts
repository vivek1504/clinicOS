import { Elysia } from "elysia";
import { ConsultationService } from "../services/consultation.service";
import {
  CreateConsultationBody,
  UpdateConsultationBody,
  ConsultationDto,
} from "../schemas/consultation";
import { IdParams, ErrorEnvelope } from "../schemas/common";
import { sessionPlugin } from "../auth";

export const consultationRoutes = new Elysia({ prefix: "/consultations" })
  .use(sessionPlugin)
  .decorate("consultationService", new ConsultationService())
  .post(
    "",
    async ({ body, set, consultationService, doctor }) => {
      const { status, consultation } = await consultationService.create(body, doctor!.id);
      set.status = status;
      return consultation;
    },
    {
      body: CreateConsultationBody,
      response: {
        200: ConsultationDto,
        201: ConsultationDto,
        400: ErrorEnvelope,
        404: ErrorEnvelope,
        409: ErrorEnvelope,
      },
    }
  )
  .patch(
    "/:id",
    async ({ params, body, consultationService }) => {
      return await consultationService.patch(params.id, body);
    },
    {
      params: IdParams,
      body: UpdateConsultationBody,
      response: {
        200: ConsultationDto,
        400: ErrorEnvelope,
        404: ErrorEnvelope,
      },
    }
  );
