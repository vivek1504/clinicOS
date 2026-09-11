import { Elysia } from "elysia";
import type { AiProvider } from "../ai/provider";
import { AiService } from "../services/ai.service";
import { VoiceService } from "../services/voice.service";
import {
  PatientSummaryBody,
  PatientSummaryResponse,
  StructureConsultationBody,
  StructureConsultationResponse,
  TranscriptionTokenResponse,
  VoiceStatusResponse,
} from "../schemas/ai";
import { ErrorEnvelope } from "../schemas/common";

export const aiRoutes = (ai: AiProvider, voice: VoiceService = new VoiceService()) => {
  const service = new AiService(ai);

  return new Elysia({ prefix: "/ai" })
    // Whether the consultation should offer a Record button at all.
    .get("/voice", () => ({ enabled: voice.enabled }), { response: { 200: VoiceStatusResponse } })
    // Short-lived AssemblyAI token; the browser streams audio to them directly.
    .post("/transcription-token", () => voice.transcriptionToken(), {
      response: { 200: TranscriptionTokenResponse, 429: ErrorEnvelope, 503: ErrorEnvelope },
    })
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
