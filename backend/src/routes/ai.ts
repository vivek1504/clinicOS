import { Elysia } from "elysia";
import type { AiProvider } from "../ai/provider";
import { AiService } from "../services/ai.service";
import {
  PatientSummaryBody,
  PatientSummaryResponse,
  StructureConsultationBody,
  StructureConsultationResponse,
} from "../schemas/ai";
import { ErrorEnvelope } from "../schemas/common";

export const aiRoutes = (ai: AiProvider) => {
  const service = new AiService(ai);

  return new Elysia({ prefix: "/ai" })
    .post(
      "/patient-summary",
      async ({ body, request }) => service.summarizePatientHistory({ patientId: body.patientId, signal: request.signal }),
      {
        body: PatientSummaryBody,
        response: {
          200: PatientSummaryResponse,
          400: ErrorEnvelope,
          404: ErrorEnvelope,
          429: ErrorEnvelope,
          502: ErrorEnvelope,
          503: ErrorEnvelope,
          504: ErrorEnvelope,
        },
      },
    )
    .post(
    "/structure-consultation",
    async ({ body, request }) => {
      return await service.structureConsultation({
        rawNotes: body.rawNotes,
        patientId: body.patientId,
        signal: request.signal,
      });
    },
    {
      body: StructureConsultationBody,
      response: {
        200: StructureConsultationResponse,
        400: ErrorEnvelope,
        404: ErrorEnvelope,
        429: ErrorEnvelope,
        502: ErrorEnvelope,
        503: ErrorEnvelope,
        504: ErrorEnvelope,
      },
    }
  );
};
