import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { env } from "./env";
import { AppError, STATUS_BY_CODE } from "./lib/errors";
import type { AiProvider } from "./ai/provider";
import { appointmentRoutes } from "./routes/appointments";
import { patientRoutes } from "./routes/patients";
import { consultationRoutes } from "./routes/consultations";
import { aiRoutes } from "./routes/ai";
import { authRoutes, requireDoctor, sessionPlugin } from "./auth";
import { GeminiProvider } from "./ai/gemini.provider";
import { FakeAiProvider } from "./ai/fake.provider";

export const buildApp = (deps: { ai: AiProvider }) =>
  new Elysia()
    .use(
      cors({
        origin: env.CORS_ORIGIN === "*" || env.CORS_ORIGIN === "true" ? true : env.CORS_ORIGIN,
        credentials: true,
      })
    )
    .use(swagger())
    .error({ AppError })
    .onError(({ code, error, set }) => {
      if (error instanceof AppError) {
        set.status = STATUS_BY_CODE[error.code] ?? 500;
        return {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }
      if (code === "VALIDATION") {
        set.status = 400;
        return {
          error: {
            code: "VALIDATION",
            message: error.message,
          },
        };
      }
      if (code === "NOT_FOUND") {
        set.status = 404;
        return {
          error: {
            code: "NOT_FOUND",
            message: "Route not found",
          },
        };
      }
      console.error(error);
      set.status = 500;
      return {
        error: {
          code: "INTERNAL",
          message: "Unexpected error",
        },
      };
    })
    .get("/health", () => ({ ok: true }))
    .use(sessionPlugin)
    .use(authRoutes)
    // Everything below needs a signed-in doctor.
    .use(requireDoctor)
    .use(appointmentRoutes)
    .use(patientRoutes)
    .use(consultationRoutes)
    .use(aiRoutes(deps.ai));

const defaultAi: AiProvider =
  env.AI_PROVIDER === "fake"
    ? new FakeAiProvider()
    : new GeminiProvider();

export const app = buildApp({ ai: defaultAi });
export default app;

