import { env } from "./env";
import { buildApp } from "./app";
import { GeminiProvider } from "./ai/gemini.provider";
import { FakeAiProvider } from "./ai/fake.provider";
import type { AiProvider } from "./ai/provider";

const ai: AiProvider =
  env.AI_PROVIDER === "fake"
    ? new FakeAiProvider()
    : new GeminiProvider();

const app = buildApp({ ai });

app.listen(env.PORT, () => {
  console.log(`EMR Backend listening on port ${env.PORT} (AI provider: ${env.AI_PROVIDER})`);
});

export { app };
