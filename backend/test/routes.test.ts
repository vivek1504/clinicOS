import { describe, it, expect, beforeEach } from "bun:test";
import { buildApp } from "../src/app";
import { FakeAiProvider } from "../src/ai/fake.provider";
import { authed, resetTestDb, TEST_PASSWORD } from "./helpers/db";
import { prisma } from "../src/lib/prisma";

describe("Elysia App Route Integration & Smoke Tests", () => {
  const fakeAi = new FakeAiProvider();
  const app = buildApp({ ai: fakeAi });
  let patientId: string;

  beforeEach(async () => {
    const { patient } = await resetTestDb();
    patientId = patient.id;
  });

  it("GET /health returns ok: true", async () => {
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body).toEqual({ ok: true });
  });

  it("GET /appointments returns rows sorted for today", async () => {
    const res = await app.handle(new Request("http://localhost/appointments", { headers: authed }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].patient.name).toBe("Test Patient");
  });

  it("GET /patients/:id returns 404 error envelope when patient does not exist", async () => {
    const res = await app.handle(new Request("http://localhost/patients/nonexistent_id", { headers: authed }));
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("Patient not found");
  });

  it("GET /patients/:id returns patient when exists", async () => {
    const res = await app.handle(new Request(`http://localhost/patients/${patientId}`, { headers: authed }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.id).toBe(patientId);
    expect(body.name).toBe("Test Patient");
    expect(body.age).toBeDefined();
    expect(body.allergies).toContain("Peanuts");
  });

  it("POST /consultations returns 400 validation error envelope on invalid input", async () => {
    const res = await app.handle(
      new Request("http://localhost/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authed },
        body: JSON.stringify({
          patientId: 123, // should be string
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION");
  });

  it("POST /ai/structure-consultation works end-to-end with Elysia app", async () => {
    const res = await app.handle(
      new Request("http://localhost/ai/structure-consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authed },
        body: JSON.stringify({
          rawNotes: "Patient presents with persistent fever and cough for three days.",
          patientId,
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.draft).toBeDefined();
    expect(body.draft.chiefComplaint).toBe("fever");
    expect(body.model).toBeDefined();
    expect(typeof body.latencyMs).toBe("number");
  });

  it("rejects protected routes without a session", async () => {
    const res = await app.handle(new Request("http://localhost/appointments"));
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("sign-in sets a session cookie, /auth/me resolves it, sign-out revokes it", async () => {
    const bad = await app.handle(
      new Request("http://localhost/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "doc@test.local", password: "wrong" }),
      }),
    );
    expect(bad.status).toBe(401);

    const ok = await app.handle(
      new Request("http://localhost/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "doc@test.local", password: TEST_PASSWORD }),
      }),
    );
    expect(ok.status).toBe(200);
    const setCookie = ok.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session=");
    expect(setCookie.toLowerCase()).toContain("httponly");
    const cookie = setCookie.split(";")[0]!;

    const me = await app.handle(new Request("http://localhost/auth/me", { headers: { cookie } }));
    expect(me.status).toBe(200);
    expect(((await me.json()) as any).doctor.email).toBe("doc@test.local");

    const out = await app.handle(new Request("http://localhost/auth/sign-out", { method: "POST", headers: { cookie } }));
    expect(out.status).toBe(200);
    const after = await app.handle(new Request("http://localhost/auth/me", { headers: { cookie } }));
    expect(after.status).toBe(401);
  });

  it("POST /ai/patient-summary summarises saved consultations and rejects an empty history", async () => {
    const empty = await app.handle(
      new Request("http://localhost/ai/patient-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authed },
        body: JSON.stringify({ patientId }),
      }),
    );
    expect(empty.status).toBe(400);

    await prisma.consultation.create({
      data: {
        patientId,
        doctorId: "doc_default",
        rawNotes: "fever 3 days",
        finalNote: { chiefComplaint: "Fever", symptoms: ["fever"], relevantHistory: [], medicationsMentioned: ["paracetamol"], doctorPlan: ["rest"], missingInformation: [] },
        wasAiUsed: false,
        wasAiEdited: false,
      },
    });
    const res = await app.handle(
      new Request("http://localhost/ai/patient-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authed },
        body: JSON.stringify({ patientId }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.basedOn).toBe(1);
    expect(body.summary).toContain("Fever");
  });
});

describe("one session per user", () => {
  const app = buildApp({ ai: new FakeAiProvider() });
  const signIn = () =>
    app.handle(
      new Request("http://localhost/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "doc@test.local", password: TEST_PASSWORD }),
      }),
    );
  const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

  it("signing in on a second device signs the first one out", async () => {
    await resetTestDb();
    const first = cookieOf(await signIn());
    const second = cookieOf(await signIn());
    expect(first).not.toBe(second);
    expect((await app.handle(new Request("http://localhost/auth/me", { headers: { cookie: first } }))).status).toBe(401);
    expect((await app.handle(new Request("http://localhost/auth/me", { headers: { cookie: second } }))).status).toBe(200);
    expect(await prisma.session.count({ where: { userId: "doc_default" } })).toBe(1);
  });
});
