import { AppError } from "../lib/errors";
import { env } from "../env";

const TOKEN_URL = "https://streaming.assemblyai.com/v3/token";
/** The browser only needs the token for the WebSocket handshake; the session outlives it. */
const TOKEN_TTL_SECONDS = 60;

export interface TranscriptionToken {
  token: string;
  expiresInSeconds: number;
}

/**
 * Voice transcription runs browser-to-AssemblyAI over a WebSocket, so audio never passes through this server
 * (which could not hold the socket open on Vercel anyway). The only thing the backend does is mint a short-lived
 * token, keeping the API key out of the browser.
 */
export class VoiceService {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  get enabled() {
    return env.ASSEMBLYAI_API_KEY.length > 0;
  }

  async transcriptionToken(): Promise<TranscriptionToken> {
    if (!this.enabled) throw new AppError("AI_UNAVAILABLE", "Voice transcription is not set up on this server");
    let res: Response;
    try {
      res = await this.fetchImpl(`${TOKEN_URL}?expires_in_seconds=${TOKEN_TTL_SECONDS}`, {
        headers: { Authorization: env.ASSEMBLYAI_API_KEY },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      console.error("[AssemblyAI Token Error]", e);
      throw new AppError("AI_UNAVAILABLE", "Voice transcription is not available right now");
    }
    if (!res.ok) {
      console.error("[AssemblyAI Token Error]", res.status, (await res.text()).slice(0, 500));
      throw new AppError(res.status === 429 ? "AI_RATE_LIMITED" : "AI_UNAVAILABLE", res.status === 429 ? "Voice transcription is busy right now" : "Voice transcription is not available right now");
    }
    const body = (await res.json()) as { token?: string; expires_in_seconds?: number };
    if (!body.token) throw new AppError("AI_UNAVAILABLE", "Voice transcription is not available right now");
    return { token: body.token, expiresInSeconds: body.expires_in_seconds ?? TOKEN_TTL_SECONDS };
  }
}
