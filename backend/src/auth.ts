import { Elysia, t } from "elysia";
import { env } from "./env";
import { AppError } from "./lib/errors";
import { AuthService, SESSION_TTL_MS } from "./services/auth.service";
import { MeResponse, SignInBody } from "./schemas/auth";
import { ErrorEnvelope } from "./schemas/common";

export const SESSION_COOKIE = "session";

const authService = new AuthService();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

/** Resolves `doctor` (or null) from the session cookie for every route in the app. */
const tokenFrom = (cookie: Record<string, { value?: unknown } | undefined>) => {
  const v = cookie[SESSION_COOKIE]?.value;
  return typeof v === "string" ? v : undefined;
};

export const sessionPlugin = new Elysia({ name: "session" }).resolve({ as: "global" }, async ({ cookie }) => ({
  doctor: await authService.doctorForToken(tokenFrom(cookie)),
}));

/** Routes registered after this hook require a signed-in doctor. */
export const requireDoctor = new Elysia({ name: "require-doctor" }).onBeforeHandle({ as: "global" }, (ctx) => {
  if (!("doctor" in ctx) || !ctx.doctor) throw new AppError("UNAUTHORIZED", "Sign in to continue");
});

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(sessionPlugin)
  .post(
    "/sign-in",
    async ({ body, cookie }) => {
      const { doctor, token } = await authService.signIn(body.email, body.password);
      cookie[SESSION_COOKIE]!.set({ value: token, ...cookieOptions });
      return { doctor };
    },
    { body: SignInBody, response: { 200: MeResponse, 400: ErrorEnvelope, 401: ErrorEnvelope } },
  )
  .post(
    "/sign-out",
    async ({ cookie }) => {
      await authService.signOut(tokenFrom(cookie));
      cookie[SESSION_COOKIE]?.remove();
      return { ok: true };
    },
    { response: { 200: t.Object({ ok: t.Boolean() }) } },
  )
  .get(
    "/me",
    ({ doctor }) => {
      if (!doctor) throw new AppError("UNAUTHORIZED", "Sign in to continue");
      return { doctor };
    },
    { response: { 200: MeResponse, 401: ErrorEnvelope } },
  );

