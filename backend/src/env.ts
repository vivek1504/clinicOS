import { z } from "zod";

const rawDbUrl =
  process.env.DATABASE_URL &&
  process.env.DATABASE_URL.length > 0 &&
  !process.env.DATABASE_URL.startsWith("$")
    ? process.env.DATABASE_URL
    : process.env.TEST_DATABASE_URL;

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  TEST_DATABASE_URL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional().default(""),
  // An unknown value (an old "gemini" setting, say) falls back to openrouter rather than refusing to boot.
  AI_PROVIDER: z.enum(["openrouter", "fake"]).catch("openrouter"),
  AI_MODEL: z.string().default("openai/gpt-4o-mini"),
  AI_TIMEOUT_MS: z.coerce.number().default(20000),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  NODE_ENV: z.string().default("development"),
});

export const env = EnvSchema.parse({
  ...process.env,
  DATABASE_URL: rawDbUrl ?? process.env.DATABASE_URL,
});

if (env.AI_PROVIDER === "openrouter" && !env.OPENROUTER_API_KEY) {
  console.warn("[WARN] OPENROUTER_API_KEY is not set. AI routes will return AI_UNAVAILABLE.");
}
