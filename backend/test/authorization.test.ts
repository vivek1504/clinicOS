import { describe, it, expect, beforeEach, setSystemTime } from "bun:test";
import { buildApp } from "../src/app";
import { FakeAiProvider } from "../src/ai/fake.provider";
import { ConsultationService } from "../src/services/consultation.service";
import { hashToken, MAX_SIGN_IN_FAILURES } from "../src/services/auth.service";
import { prisma } from "../src/lib/prisma";
import { authed, authedReception, resetTestDb, TEST_PASSWORD } from "./helpers/db";

const OTHER_SESSION = "other-doctor-session";
const other = { cookie: `session=${OTHER_SESSION}` };
const json = (h: Record<string, string>) => ({ ...h, "content-type": "application/json" });

const note = {
  chiefComplaint: "Fever",
  symptoms: ["fever"],
  relevantHistory: [],
  medicationsMentioned: [],
  doctorPlan: ["rest"],
  missingInformation: [],
};

const body = (overrides: Record<string, unknown> = {}) => ({
  patientId: "pat_test_1",
  appointmentId: "appt_test_1",
  clientRequestId: "0b0a1a3e-4a7a-4d3c-9d0e-1f2a3b4c5d6e",
  rawNotes: "Fever for two days. Rest.",
  aiDraft: null,
  finalNote: note,
  wasAiUsed: false,
  wasAiEdited: false,
  ...overrides,
});

/** Two doctors in one clinic: patients and the schedule are shared, but consultations and appointments have an owner. */
describe("resource ownership", () => {
  const app = buildApp({ ai: new FakeAiProvider() });
  const call = (path: string, init?: RequestInit) => app.handle(new Request(`http://localhost${path}`, init));

  beforeEach(async () => {
    await resetTestDb();
    const doc = await prisma.user.create({ data: { id: "doc_other", name: "Dr. Other", email: "other@test.local", passwordHash: "x" } });
    await prisma.session.create({ data: { id: hashToken(OTHER_SESSION), userId: doc.id, expiresAt: new Date(Date.now() + 60_000) } });
  });

  it("another doctor cannot edit a consultation, and cannot learn that it exists", async () => {
    const created = await call("/consultations", { method: "POST", headers: json(authed), body: JSON.stringify(body()) });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const res = await call(`/consultations/${id}`, { method: "PATCH", headers: json(other), body: JSON.stringify({ rawNotes: "tampered" }) });
    expect(res.status).toBe(404);
    expect((await prisma.consultation.findUnique({ where: { id } }))?.rawNotes).toBe("Fever for two days. Rest.");

    const own = await call(`/consultations/${id}`, { method: "PATCH", headers: json(authed), body: JSON.stringify({ rawNotes: "corrected" }) });
    expect(own.status).toBe(200);
  });

  it("another doctor cannot complete an appointment by saving a consultation against it", async () => {
    const res = await call("/consultations", { method: "POST", headers: json(other), body: JSON.stringify(body()) });
    expect(res.status).toBe(403);
    expect((await prisma.appointment.findUnique({ where: { id: "appt_test_1" } }))?.status).toBe("WAITING");
    expect(await prisma.consultation.count()).toBe(0);
  });

  it("another doctor cannot start, finish or move someone else's appointment; the front desk still can", async () => {
    const patch = (headers: Record<string, string>, payload: unknown) =>
      call("/appointments/appt_test_1", { method: "PATCH", headers: json(headers), body: JSON.stringify(payload) });
    expect((await patch(other, { status: "IN_CONSULTATION" })).status).toBe(403);
    expect((await patch(other, { reason: "moved" })).status).toBe(403);
    expect((await patch(authed, { status: "IN_CONSULTATION" })).status).toBe(200);
  });

  it("patient records are clinic-wide: any doctor may read history and run AI on any patient", async () => {
    await call("/consultations", { method: "POST", headers: json(authed), body: JSON.stringify(body()) });
    expect((await call("/patients/pat_test_1/consultations", { headers: other })).status).toBe(200);
    const ai = await call("/ai/structure-consultation", {
      method: "POST",
      headers: json(other),
      body: JSON.stringify({ patientId: "pat_test_1", rawNotes: "Fever and cough for two days, no rash." }),
    });
    expect(ai.status).toBe(200);
  });
});

describe("idempotency under concurrency", () => {
  const service = new ConsultationService();

  beforeEach(async () => {
    await resetTestDb();
  });

  it("two identical requests at once produce one row, one 201 and one 200", async () => {
    const results = await Promise.all([service.create(body(), "doc_default"), service.create(body(), "doc_default")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(results[0].consultation.id).toBe(results[1].consultation.id);
    expect(await prisma.consultation.count()).toBe(1);
  });

  it("the same key with different content is refused rather than answered with the old record", async () => {
    await service.create(body(), "doc_default");
    const again = service.create(body({ rawNotes: "Something else entirely." }), "doc_default");
    await expect(again).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("provenance is what the server saw, not what the client claimed", async () => {
    const res = await service.create(body({ wasAiUsed: true, aiModel: "made-up", aiLatencyMs: 1 }), "doc_default");
    expect(res.consultation.wasAiUsed).toBe(false);
    expect(res.consultation.aiModel).toBeNull();
    expect(res.consultation.aiLatencyMs).toBeNull();
  });
});

describe("request limits and abuse", () => {
  const app = buildApp({ ai: new FakeAiProvider() });
  const call = (path: string, init?: RequestInit) => app.handle(new Request(`http://localhost${path}`, init));

  beforeEach(async () => {
    await resetTestDb();
  });

  it("two registrations with the same phone at once leave one patient", async () => {
    const reg = () =>
      call("/patients", { method: "POST", headers: json(authed), body: JSON.stringify({ name: "Twin", dob: "1990-01-01", gender: "OTHER", phone: "9876512345" }) });
    const [a, b] = await Promise.all([reg(), reg()]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(await prisma.patient.count({ where: { phone: "9876512345" } })).toBe(1);
  });

  it("changing a patient's phone to one already registered is refused", async () => {
    const res = await call("/patients/pat_test_1", { method: "PATCH", headers: json(authed), body: JSON.stringify({ phone: "9876599999" }) });
    expect(res.status).toBe(200); // same number, same patient
    const p = await prisma.patient.create({ data: { name: "B", dob: new Date("1990-01-01"), gender: "MALE", phone: "9876500001" } });
    const clash = await call(`/patients/${p.id}`, { method: "PATCH", headers: json(authed), body: JSON.stringify({ phone: "9876599999" }) });
    expect(clash.status).toBe(409);
  });

  it("oversized arrays are rejected before they reach the database", async () => {
    const res = await call("/patients", {
      method: "POST",
      headers: json(authed),
      body: JSON.stringify({ name: "Big", dob: "1990-01-01", gender: "OTHER", phone: "9876500002", allergies: Array(51).fill("x") }),
    });
    expect(res.status).toBe(400);
    const note51 = { ...note, symptoms: Array(101).fill("s") };
    const c = await call("/consultations", { method: "POST", headers: json(authed), body: JSON.stringify(body({ finalNote: note51 })) });
    expect(c.status).toBe(400);
  });

  it("repeated wrong passwords lock the account for a while, even against the right password", async () => {
    const signIn = (password: string) =>
      call("/auth/sign-in", { method: "POST", headers: json({}), body: JSON.stringify({ email: "doc@test.local", password }) });
    for (let i = 0; i < MAX_SIGN_IN_FAILURES; i++) expect((await signIn("wrong")).status).toBe(401);
    expect((await signIn(TEST_PASSWORD)).status).toBe(429);
    // Once the lock has passed, one more wrong password is a strike, not another 15-minute lock.
    try {
      setSystemTime(new Date(Date.now() + 16 * 60 * 1000));
      expect((await signIn("wrong")).status).toBe(401);
      expect((await signIn(TEST_PASSWORD)).status).toBe(200);
    } finally {
      setSystemTime();
    }
  });

  it("the lock is per address: a stranger's failures do not lock the doctor out", async () => {
    const signIn = (password: string, ip: string) =>
      call("/auth/sign-in", { method: "POST", headers: json({ "x-forwarded-for": ip }), body: JSON.stringify({ email: "doc@test.local", password }) });
    for (let i = 0; i < MAX_SIGN_IN_FAILURES; i++) await signIn("wrong", "203.0.113.9");
    expect((await signIn(TEST_PASSWORD, "203.0.113.9")).status).toBe(429);
    expect((await signIn(TEST_PASSWORD, "198.51.100.7")).status).toBe(200);
  });

  it("an empty consultation PATCH changes nothing and says so", async () => {
    const { consultation } = await new ConsultationService().create(body(), "doc_default");
    const res = await call(`/consultations/${consultation.id}`, { method: "PATCH", headers: json(authed), body: "{}" });
    expect(res.status).toBe(400);
  });
});

/** Two people act on one appointment at the same moment. Whoever writes first wins; the other is told to reload, and the row never ends up in a state nobody asked for. */
describe("concurrent changes to one appointment", () => {
  const app = buildApp({ ai: new FakeAiProvider() });
  const call = (path: string, init?: RequestInit) => app.handle(new Request(`http://localhost${path}`, init));
  const cancel = () => call("/appointments/appt_test_1", { method: "PATCH", headers: json(authedReception), body: JSON.stringify({ status: "CANCELLED" }) });

  beforeEach(async () => {
    await resetTestDb();
  });

  it("saving a consultation while the desk cancels: one wins, the record agrees with the winner", async () => {
    const save = () => call("/consultations", { method: "POST", headers: json(authed), body: JSON.stringify(body()) });
    const [s, c] = await Promise.all([save(), cancel()]);
    expect([s.status, c.status].sort()).toEqual(s.status === 201 ? [201, 409] : [200, 409]);
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: "appt_test_1" }, include: { consultation: true } });
    if (appt.consultation) expect(appt.status).toBe("COMPLETED");
    else expect(appt.status).toBe("CANCELLED");
  });

  it("completing while the desk cancels: exactly one status change lands", async () => {
    const complete = () => call("/appointments/appt_test_1", { method: "PATCH", headers: json(authed), body: JSON.stringify({ status: "COMPLETED" }) });
    const [a, b] = await Promise.all([complete(), cancel()]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: "appt_test_1" } });
    expect(a.status === 200 ? "COMPLETED" : "CANCELLED").toBe(appt.status);
  });
});

describe("fake AI provider honours the no-invention contract", () => {
  it("never writes a plan, complaint or advice the notes did not contain", async () => {
    const fake = new FakeAiProvider();
    const { text } = await fake.structure({ rawNotes: "Patient has cough." });
    const out = JSON.parse(text);
    expect(out.doctorPlan).toEqual([]);
    expect(out.chiefComplaint).toBe("cough");
    const vague = JSON.parse((await fake.structure({ rawNotes: "Patient feels unwell today." })).text);
    expect(vague.chiefComplaint).toBeNull();
    expect(vague.doctorPlan).toEqual([]);
  });
});
