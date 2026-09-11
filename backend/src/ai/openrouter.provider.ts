import { SUMMARY_INSTRUCTION, SYSTEM_INSTRUCTION, buildUserContent } from "./prompt";
import { StructuredNoteJsonSchema } from "./schema";
import { type AiProvider, AiProviderError } from "./provider";
import { env } from "../env";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type Message = { role: "system" | "user"; content: string };

/**
 * Upstream errors are logged in full here and never forwarded: the provider's JSON is not something a
 * doctor should read, and the frontend already has copy for every code.
 */
export function mapOpenRouterError(e: unknown): Error {
  if (e instanceof AiProviderError) return e;
  if (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")) {
    return new AiProviderError("AI_TIMEOUT", "The AI did not answer in time");
  }
  console.error("[OpenRouter Unexpected Error]", e);
  return new AiProviderError("AI_UNAVAILABLE", "AI assistance is not available");
}

export function mapStatus(status: number): AiProviderError {
  if (status === 408 || status === 504) return new AiProviderError("AI_TIMEOUT", "The AI did not answer in time");
  if (status === 429) return new AiProviderError("AI_RATE_LIMITED", "The AI is busy right now");
  return new AiProviderError("AI_UNAVAILABLE", "AI assistance is not available");
}

/** Reads the assistant text out of a chat completion; some models return content as parts. */
export function completionText(body: unknown): string {
  const content = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p?.text === "string" ? p.text : "")).join("");
  return "";
}

/** OpenAI-compatible chat completions through OpenRouter, so the model is a config value, not a dependency. */
export class OpenRouterProvider implements AiProvider {
  readonly model = env.AI_MODEL;
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  private async complete(messages: Message[], opts: { maxTokens: number; jsonSchema?: boolean; signal?: AbortSignal }): Promise<{ text: string }> {
    if (!env.OPENROUTER_API_KEY) throw new AiProviderError("AI_UNAVAILABLE", "OPENROUTER_API_KEY is not set");
    const signals = [AbortSignal.timeout(env.AI_TIMEOUT_MS), ...(opts.signal ? [opts.signal] : [])];
    const body: Record<string, unknown> = { model: this.model, messages, temperature: 0, max_tokens: opts.maxTokens };
    if (opts.jsonSchema) {
      body.response_format = { type: "json_schema", json_schema: { name: "structured_note", strict: true, schema: StructuredNoteJsonSchema } };
    }
    try {
      let res = await this.post(body, AbortSignal.any(signals));
      // Not every model accepts a JSON schema; the normalizer and repair pass cope with plain JSON, so retry without it.
      if (res.status === 400 && opts.jsonSchema && (await res.clone().text()).toLowerCase().includes("response_format")) {
        delete body.response_format;
        res = await this.post(body, AbortSignal.any(signals));
      }
      if (!res.ok) {
        console.error("[OpenRouter API Error]", res.status, (await res.text()).slice(0, 500));
        throw mapStatus(res.status);
      }
      const data = (await res.json()) as { error?: { message?: string } };
      if (data.error) {
        console.error("[OpenRouter API Error]", data.error.message);
        throw new AiProviderError("AI_UNAVAILABLE", "AI assistance is not available");
      }
      return { text: completionText(data) };
    } catch (e) {
      throw mapOpenRouterError(e);
    }
  }

  private post(body: Record<string, unknown>, signal: AbortSignal) {
    return this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "ClinicOS",
      },
      body: JSON.stringify(body),
      signal,
    });
  }

  structure({ rawNotes, repair, signal }: { rawNotes: string; repair?: { previousOutput: string; problem: string }; signal?: AbortSignal }) {
    return this.complete(
      [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: buildUserContent(rawNotes, repair) },
      ],
      { maxTokens: 2048, jsonSchema: true, signal },
    );
  }

  summarize({ record, signal }: { record: string; signal?: AbortSignal }) {
    return this.complete(
      [
        { role: "system", content: SUMMARY_INSTRUCTION },
        { role: "user", content: `<record>\n${record}\n</record>` },
      ],
      { maxTokens: 512, signal },
    );
  }
}
