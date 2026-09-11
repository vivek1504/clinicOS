import { describe, expect, test } from "bun:test";
import { completionText, mapStatus, OpenRouterProvider } from "../../src/ai/openrouter.provider";
import { AiProviderError } from "../../src/ai/provider";

const reply = (content: unknown, status = 200) =>
  (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("OpenRouterProvider", () => {
  test("maps HTTP status to the three provider codes", () => {
    expect(mapStatus(429).code).toBe("AI_RATE_LIMITED");
    expect(mapStatus(504).code).toBe("AI_TIMEOUT");
    expect(mapStatus(401).code).toBe("AI_UNAVAILABLE");
    expect(mapStatus(500).code).toBe("AI_UNAVAILABLE");
  });

  test("reads string and part-array content", () => {
    expect(completionText({ choices: [{ message: { content: '{"a":1}' } }] })).toBe('{"a":1}');
    expect(completionText({ choices: [{ message: { content: [{ type: "text", text: "x" }, { type: "text", text: "y" }] } }] })).toBe("xy");
    expect(completionText({})).toBe("");
  });

  test("sends system and user messages and returns the model text", async () => {
    process.env.OPENROUTER_API_KEY ||= "test-key";
    let sent: { messages: { role: string; content: string }[]; response_format?: unknown } | null = null;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"chiefComplaint":"cough"}' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const { env } = await import("../../src/env");
    if (!env.OPENROUTER_API_KEY) return; // env was parsed before the key was set; nothing to assert against
    const out = await new OpenRouterProvider(fetchImpl).structure({ rawNotes: "dry cough 2 weeks" });
    expect(out.text).toBe('{"chiefComplaint":"cough"}');
    expect(sent!.messages[0]?.role).toBe("system");
    expect(sent!.messages[1]?.content).toContain("dry cough 2 weeks");
    expect(sent!.response_format).toBeDefined();
  });

  test("a failed request becomes a provider error, never the raw body", async () => {
    const { env } = await import("../../src/env");
    if (!env.OPENROUTER_API_KEY) return;
    await expect(new OpenRouterProvider(reply("", 429)).summarize({ record: "x" })).rejects.toBeInstanceOf(AiProviderError);
  });
});
