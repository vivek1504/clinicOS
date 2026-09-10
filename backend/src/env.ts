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
  GEMINI_API_KEY: z.string().optional().default(""),
  AI_PROVIDER: z.enum(["gemini", "fake"]).default("gemini"),
  AI_MODEL: z.string().default("gemini-2.5-flash"),
  AI_TIMEOUT_MS: z.coerce.number().default(20000),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  NODE_ENV: z.string().default("development"),
});

export const env = EnvSchema.parse({
  ...process.env,
  DATABASE_URL: rawDbUrl ?? process.env.DATABASE_URL,
});

if (env.AI_PROVIDER === "gemini" && !env.GEMINI_API_KEY) {
  console.warn("[WARN] GEMINI_API_KEY is not set. AI routes will return AI_UNAVAILABLE.");
}
