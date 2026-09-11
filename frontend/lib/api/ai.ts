import { ApiError, apiFetch } from "./client";
import type { AiStructureResponse } from "./types";

export const AI_CANCELLED = "AI_CANCELLED";

export async function structureConsultation(
  input: { rawNotes: string; patientId: string },
  signal: AbortSignal,
): Promise<AiStructureResponse> {
  try {
    return await apiFetch<AiStructureResponse>("/ai/structure-consultation", {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(AI_CANCELLED, "Generation cancelled", 0);
    }
    if (err instanceof ApiError && err.code === "NETWORK") {
      throw new ApiError("AI_UNAVAILABLE", err.message, 0);
    }
    throw err;
  }
}

export interface PatientSummaryResponse {
  summary: string;
  model: string;
  latencyMs: number;
  basedOn: number;
}

export async function summarizePatientHistory(patientId: string, signal: AbortSignal): Promise<PatientSummaryResponse> {
  try {
    return await apiFetch<PatientSummaryResponse>("/ai/patient-summary", {
      method: "POST",
      body: JSON.stringify({ patientId }),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new ApiError(AI_CANCELLED, "Cancelled", 0);
    if (err instanceof ApiError && err.code === "NETWORK") throw new ApiError("AI_UNAVAILABLE", err.message, 0);
    throw err;
  }
}

/** Whether the server has voice transcription configured; the consultation hides Record when it does not. */
export async function getVoiceStatus(): Promise<{ enabled: boolean }> {
  return apiFetch<{ enabled: boolean }>("/ai/voice");
}

/** Short-lived AssemblyAI token; the browser streams audio to them directly, the key never leaves the server. */
export async function getTranscriptionToken(): Promise<{ token: string; expiresInSeconds: number }> {
  try {
    return await apiFetch("/ai/transcription-token", { method: "POST" });
  } catch (err) {
    if (err instanceof ApiError && err.code === "NETWORK") throw new ApiError("AI_UNAVAILABLE", err.message, 0);
    throw err;
  }
}
