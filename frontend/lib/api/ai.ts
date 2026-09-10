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
