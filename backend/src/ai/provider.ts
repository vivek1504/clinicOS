export interface AiProvider {
  readonly model: string;
  structure(input: {
    rawNotes: string;
    repair?: { previousOutput: string; problem: string };
    signal?: AbortSignal;
  }): Promise<{ text: string }>;
  /** Plain-prose summary of a patient's saved consultations. */
  summarize(input: { record: string; signal?: AbortSignal }): Promise<{ text: string }>;
}

export class AiProviderError extends Error {
  constructor(
    public code: "AI_TIMEOUT" | "AI_RATE_LIMITED" | "AI_UNAVAILABLE",
    message: string
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
