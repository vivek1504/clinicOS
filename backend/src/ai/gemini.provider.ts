import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { SUMMARY_INSTRUCTION, SYSTEM_INSTRUCTION, buildUserContent } from "./prompt";
import { StructuredNoteJsonSchema } from "./schema";
import { type AiProvider, AiProviderError } from "./provider";
import { env } from "../env";

export function thinkingConfigFor(model: string) {
  if (model.includes("gemini-3")) {
    return { thinkingLevel: ThinkingLevel.LOW };
  }
  return { thinkingBudget: 0 };
}

export function mapGeminiError(e: unknown): Error {
  if (e instanceof AiProviderError) return e;

  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    if (e.name === "AbortError" || msg.includes("abort") || msg.includes("timeout")) {
      return new AiProviderError("AI_TIMEOUT", e.message);
    }
  }

  if (e && typeof e === "object" && "status" in e) {
    const status = (e as { status: number }).status;
    const msg = (e as { message?: string }).message || "Gemini API error";
    if (status === 408 || status === 504) {
      return new AiProviderError("AI_TIMEOUT", msg);
    }
    if (status === 429) {
      return new AiProviderError("AI_RATE_LIMITED", msg);
    }
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      console.error("[Gemini API Error]", e);
      return new AiProviderError("AI_UNAVAILABLE", msg);
    }
    if (status >= 500) {
      return new AiProviderError("AI_UNAVAILABLE", msg);
    }
  }

  console.error("[Gemini API Unexpected Error]", e);
  return new AiProviderError(
    "AI_UNAVAILABLE",
    e instanceof Error ? e.message : "AI provider unavailable"
  );
}

export class GeminiProvider implements AiProvider {
  private ai: GoogleGenAI | null = null;
  readonly model = env.AI_MODEL;

  constructor() {
    if (env.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
  }

  async structure({
    rawNotes,
    repair,
    signal,
  }: {
    rawNotes: string;
    repair?: { previousOutput: string; problem: string };
    signal?: AbortSignal;
  }): Promise<{ text: string }> {
    if (!env.GEMINI_API_KEY || !this.ai) {
      throw new AiProviderError("AI_UNAVAILABLE", "GEMINI_API_KEY is not set");
    }

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: buildUserContent(rawNotes, repair),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0,
          responseMimeType: "application/json",
          responseJsonSchema: StructuredNoteJsonSchema,
          thinkingConfig: thinkingConfigFor(this.model),
          maxOutputTokens: 2048,
          abortSignal: signal,
          httpOptions: { timeout: env.AI_TIMEOUT_MS },
        },
      });

      const blocked = response.promptFeedback?.blockReason;
      if (blocked) {
        throw new AiProviderError("AI_UNAVAILABLE", `Prompt blocked: ${blocked}`);
      }

      const finish = response.candidates?.[0]?.finishReason;
      const text = response.text ?? "";
      if (!text || (finish && finish !== "STOP")) {
        return { text };
      }
      return { text };
    } catch (e) {
      throw mapGeminiError(e);
    }
  }

  async summarize({ record, signal }: { record: string; signal?: AbortSignal }): Promise<{ text: string }> {
    if (!env.GEMINI_API_KEY || !this.ai) {
      throw new AiProviderError("AI_UNAVAILABLE", "GEMINI_API_KEY is not set");
    }
    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: `<record>\n${record}\n</record>`,
        config: {
          systemInstruction: SUMMARY_INSTRUCTION,
          temperature: 0,
          thinkingConfig: thinkingConfigFor(this.model),
          maxOutputTokens: 512,
          abortSignal: signal,
          httpOptions: { timeout: env.AI_TIMEOUT_MS },
        },
      });
      const blocked = response.promptFeedback?.blockReason;
      if (blocked) throw new AiProviderError("AI_UNAVAILABLE", `Prompt blocked: ${blocked}`);
      return { text: response.text ?? "" };
    } catch (e) {
      throw mapGeminiError(e);
    }
  }
}
