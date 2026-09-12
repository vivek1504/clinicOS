import { type AiProvider, AiProviderError } from "./provider";

export type FakeMode =
  | "ok"
  | "prose"
  | "fenced"
  | "invalid"
  | "timeout"
  | "rate_limited"
  | "unavailable";

export interface FakeAiProviderOptions {
  mode?: FakeMode;
  modes?: FakeMode[];
  fixture?: Record<string, unknown>;
  model?: string;
}

export class FakeAiProvider implements AiProvider {
  readonly model: string;
  private currentMode: FakeMode;
  private modes: FakeMode[];
  private callCount = 0;
  private fixture?: Record<string, unknown>;
  public readonly calls: Array<{
    rawNotes: string;
    repair?: { previousOutput: string; problem: string };
  }> = [];

  constructor(options?: FakeAiProviderOptions) {
    this.model = options?.model ?? "fake-model-1";
    this.currentMode = options?.mode ?? "ok";
    this.modes = options?.modes ?? [];
    this.fixture = options?.fixture;
  }

  setMode(mode: FakeMode) {
    this.currentMode = mode;
  }

  private generateDefaultNote(rawNotes: string): Record<string, unknown> {
    if (this.fixture) {
      return { ...this.fixture };
    }

    const lower = rawNotes.toLowerCase();
    const symptoms: string[] = [];
    if (lower.includes("fever")) symptoms.push("fever");
    if (lower.includes("cough")) symptoms.push("cough");
    if (lower.includes("headache")) symptoms.push("headache");
    if (lower.includes("rash")) symptoms.push("rash");
    if (lower.includes("throat") || lower.includes("sore throat")) symptoms.push("sore throat");
    if (lower.includes("pain")) symptoms.push("pain");

    const meds: string[] = [];
    if (lower.includes("paracetamol")) meds.push("paracetamol");
    if (lower.includes("ibuprofen")) meds.push("ibuprofen");
    if (lower.includes("amoxicillin")) meds.push("amoxicillin");
    if (lower.includes("cetirizine")) meds.push("cetirizine");

    const history: string[] = [];
    if (lower.includes("asthma")) history.push("asthma");
    if (lower.includes("diabetes") || lower.includes("t2d")) history.push("type 2 diabetes");
    if (lower.includes("hypertension") || lower.includes("htn")) history.push("hypertension");

    // Same contract as the real prompt: a plan only exists if the notes state one. Nothing is inferred.
    const plan: string[] = [];
    if (lower.includes("rest")) plan.push("rest");
    if (lower.includes("follow up") || lower.includes("follow-up")) plan.push("follow up");

    const missing: string[] = [];
    if (!lower.includes("bp") && !lower.includes("blood pressure")) missing.push("blood pressure");
    if (!lower.includes("temp") && !lower.includes("temperature")) missing.push("temperature");
    if (!lower.includes("allerg")) missing.push("allergies inquiry");

    const chiefComplaint = symptoms[0] ?? null;

    return {
      chiefComplaint,
      symptoms,
      relevantHistory: history,
      medicationsMentioned: meds,
      doctorPlan: plan,
      missingInformation: missing,
    };
  }

  async structure(input: {
    rawNotes: string;
    repair?: { previousOutput: string; problem: string };
    signal?: AbortSignal;
  }): Promise<{ text: string }> {
    this.calls.push({ rawNotes: input.rawNotes, repair: input.repair });
    const mode = this.modes[this.callCount] ?? this.currentMode;
    this.callCount++;

    if (input.signal?.aborted) {
      throw new AiProviderError("AI_TIMEOUT", "Operation aborted");
    }

    switch (mode) {
      case "timeout":
        throw new AiProviderError("AI_TIMEOUT", "AI provider request timed out");
      case "rate_limited":
        throw new AiProviderError("AI_RATE_LIMITED", "AI provider rate limited");
      case "unavailable":
        throw new AiProviderError("AI_UNAVAILABLE", "AI provider service unavailable");
      case "invalid":
        return {
          text: JSON.stringify({
            ...this.generateDefaultNote(input.rawNotes),
            disallowedExtraField: "violation",
          }),
        };
      case "fenced": {
        const json = JSON.stringify(this.generateDefaultNote(input.rawNotes), null, 2);
        return { text: `\`\`\`json\n${json}\n\`\`\`` };
      }
      case "prose": {
        const json = JSON.stringify(this.generateDefaultNote(input.rawNotes), null, 2);
        return {
          text: `Here is the structured medical note according to the requested schema:\n\n${json}\n\nI hope this accurately reflects the consultation notes.`,
        };
      }
      case "ok":
      default:
        return {
          text: JSON.stringify(this.generateDefaultNote(input.rawNotes)),
        };
    }
  }

  async summarize(input: { record: string; signal?: AbortSignal }): Promise<{ text: string }> {
    const mode = this.modes[this.callCount] ?? this.currentMode;
    this.callCount++;
    if (mode === "timeout") throw new AiProviderError("AI_TIMEOUT", "AI provider request timed out");
    if (mode === "rate_limited") throw new AiProviderError("AI_RATE_LIMITED", "AI provider rate limited");
    if (mode === "unavailable") throw new AiProviderError("AI_UNAVAILABLE", "AI provider service unavailable");
    if (mode === "invalid") return { text: "" };
    const visits = (input.record.match(/^Visit /gm) ?? []).length;
    if (visits === 0) return { text: "No saved consultations." };
    const complaints = [...input.record.matchAll(/complaint: (.+)$/gm)].map((m) => m[1]).slice(0, 3);
    return { text: `The record holds ${visits} saved visit${visits === 1 ? "" : "s"}. Complaints noted: ${complaints.join("; ")}.` };
  }
}
