import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { aiRoutes } from "../src/routes/ai";
import { FakeAiProvider } from "../src/ai/fake.provider";
import { VoiceService } from "../src/services/voice.service";
import { buildApp } from "../src/app";
import { AppError, STATUS_BY_CODE } from "../src/lib/errors";
import { env } from "../src/env";
import { authed, authedReception, resetTestDb } from "./helpers/db";

const errorApp = (routes: ReturnType<typeof aiRoutes>) =>
  new Elysia()
    .error({ AppError })
    .onError(({ error, set }) => {
      if (error instanceof AppError) {
        set.status = STATUS_BY_CODE[error.code];
        return { error: { code: error.code, message: error.message } };
      }
    })
    .use(routes);

describe("voice transcription", () => {
  it("reports disabled and refuses a token when no key is configured", async () => {
    const app = errorApp(aiRoutes(new FakeAiProvider(), new VoiceService()));
    if (env.ASSEMBLYAI_API_KEY) return; // a real key in .env would make this environment-dependent
    const status = await app.handle(new Request("http://localhost/ai/voice"));
    expect(await status.json()).toEqual({ enabled: false });
    const token = await app.handle(new Request("http://localhost/ai/transcription-token", { method: "POST" }));
    expect(token.status).toBe(503);
    expect(((await token.json()) as { error: { code: string } }).error.code).toBe("AI_UNAVAILABLE");
  });

  it("returns the upstream token and never its error body", async () => {
    const withKey = { ...env, ASSEMBLYAI_API_KEY: "k" };
    class Enabled extends VoiceService {
      override get enabled() {
        return withKey.ASSEMBLYAI_API_KEY.length > 0;
      }
    }
    const ok = new Enabled((async () => Response.json({ token: "tok", expires_in_seconds: 60 })) as unknown as typeof fetch);
    expect(await ok.transcriptionToken()).toEqual({ token: "tok", expiresInSeconds: 60 });

    const busy = new Enabled((async () => new Response('{"error":"secret upstream detail"}', { status: 429 })) as unknown as typeof fetch);
    const err = await busy.transcriptionToken().catch((e) => e as AppError);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("AI_RATE_LIMITED");
    expect((err as AppError).message).not.toContain("secret");
  });

  it("is doctor-only like the rest of /ai", async () => {
    await resetTestDb();
    const app = buildApp({ ai: new FakeAiProvider() });
    expect((await app.handle(new Request("http://localhost/ai/voice"))).status).toBe(401);
    expect((await app.handle(new Request("http://localhost/ai/voice", { headers: authedReception }))).status).toBe(403);
    expect((await app.handle(new Request("http://localhost/ai/voice", { headers: authed }))).status).toBe(200);
  });
});
