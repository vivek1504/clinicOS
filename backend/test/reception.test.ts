import { describe, it, expect, beforeEach } from "bun:test";
import { buildApp } from "../src/app";
import { FakeAiProvider } from "../src/ai/fake.provider";
import { authed, authedReception, resetTestDb } from "./helpers/db";
import { prisma } from "../src/lib/prisma";

const app = buildApp({ ai: new FakeAiProvider() });
const json = (headers: Record<string, string>) => ({ "Content-Type": "application/json", ...headers });
const call = (path: string, init: RequestInit = {}) => app.handle(new Request(`http://localhost${path}`, init));
const at = (hour: number, minute = 0) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
};
/** Bookings made through the API must be in the future. */
const tomorrowAt = (hour: number, minute = 0) => {
  const d = at(hour, minute);
  d.setDate(d.getDate() + 1);
  return d;
};

describe("Receptionist role", () => {
  let appointmentId: string;
  beforeEach(async () => {
    const { appointment } = await resetTestDb();
    appointmentId = appointment.id;
    await prisma.appointment.update({ where: { id: appointmentId }, data: { scheduledAt: at(8), status: "BOOKED" } });
  });

  it("sees the schedule and patients, never clinical content or AI", async () => {
    expect((await call("/appointments", { headers: authedReception })).status).toBe(200);
    expect((await call("/patients", { headers: authedReception })).status).toBe(200);
    expect((await call("/doctors", { headers: authedReception })).status).toBe(200);
    const me = (await (await call("/auth/me", { headers: authedReception })).json()) as any;
    expect(me.doctor.role).toBe("RECEPTIONIST");

    expect((await call("/patients/pat_test_1/consultations", { headers: authedReception })).status).toBe(403);
    // Well-formed bodies: validation runs before the role hook, so a bad body would 400 first.
    const note = { chiefComplaint: "x", symptoms: [], relevantHistory: [], medicationsMentioned: [], doctorPlan: [], missingInformation: [] };
    const consultation = { patientId: "pat_test_1", clientRequestId: "4f3f4b8e-2f7b-4c8d-9d3e-1a2b3c4d5e6f", rawNotes: "notes", aiDraft: null, finalNote: note, wasAiUsed: false, wasAiEdited: false };
    expect((await call("/consultations", { method: "POST", headers: json(authedReception), body: JSON.stringify(consultation) })).status).toBe(403);
    const ai = { rawNotes: "Patient presents with persistent fever and cough for three days.", patientId: "pat_test_1" };
    expect((await call("/ai/structure-consultation", { method: "POST", headers: json(authedReception), body: JSON.stringify(ai) })).status).toBe(403);
    // Doctors still can.
    expect((await call("/patients/pat_test_1/consultations", { headers: authed })).status).toBe(200);
  });

  it("checks in, marks absent and cancels, but cannot start a consultation", async () => {
    const patch = (status: string, headers = authedReception) =>
      call(`/appointments/${appointmentId}`, { method: "PATCH", headers: json(headers), body: JSON.stringify({ status }) });

    expect((await patch("IN_CONSULTATION")).status).toBe(409); // nobody starts a patient who has not been checked in
    expect((await patch("WAITING")).status).toBe(200); // check-in
    expect((await patch("IN_CONSULTATION")).status).toBe(403); // checked in, but only a doctor may start
    expect((await patch("NO_SHOW")).status).toBe(200);
    expect((await patch("WAITING")).status).toBe(200);
    expect((await patch("CANCELLED")).status).toBe(200);
    expect((await patch("BOOKED")).status).toBe(200); // undo
    expect((await patch("WAITING", authed)).status).toBe(403); // doctors do not check patients in
    expect((await patch("IN_CONSULTATION", authed)).status).toBe(409); // and cannot start one who has not been checked in
    expect((await patch("WAITING")).status).toBe(200);
    expect((await patch("IN_CONSULTATION", authed)).status).toBe(200);
  });

  it("registers patients and refuses a duplicate phone number outright", async () => {
    const body = { name: "New Person", dob: "1990-05-05", gender: "OTHER", phone: "9876599999" };
    const dup = await call("/patients", { method: "POST", headers: json(authedReception), body: JSON.stringify(body) });
    expect(dup.status).toBe(409);
    const err = (await dup.json()) as any;
    expect(err.error.details.patientId).toBe("pat_test_1");

    const ok = await call("/patients", { method: "POST", headers: json(authedReception), body: JSON.stringify({ ...body, phone: "9876543210", allergies: [" Latex ", ""] }) });
    expect(ok.status).toBe(201);
    const created = (await ok.json()) as any;
    expect(created.allergies).toEqual(["Latex"]);

    const edited = await call(`/patients/${created.id}`, { method: "PATCH", headers: json(authedReception), body: JSON.stringify({ phone: "9876500000" }) });
    expect(edited.status).toBe(200);
    expect(((await edited.json()) as any).phone).toBe("9876500000");
    // Anything but ten digits is refused.
    expect((await call(`/patients/${created.id}`, { method: "PATCH", headers: json(authedReception), body: JSON.stringify({ phone: "+91 98765 00000" }) })).status).toBe(400);

    // Phone search finds by digits.
    const found = (await (await call("/patients?q=500000", { headers: authedReception })).json()) as any[];
    expect(found.map((p) => p.id)).toEqual([created.id]);
  });

  it("books, refuses a double-booked slot, and reschedules", async () => {
    const book = (scheduledAt: Date, extra: object = {}) =>
      call("/appointments", {
        method: "POST",
        headers: json(authedReception),
        body: JSON.stringify({ patientId: "pat_test_1", doctorId: "doc_default", scheduledAt: scheduledAt.toISOString(), reason: "Check-up", ...extra }),
      });

    const past = await book(at(0, 1));
    expect(past.status).toBe(400); // earlier today: refused
    expect((await book(tomorrowAt(10, 20))).status).toBe(400); // off the 15-minute grid: refused
    const first = await book(tomorrowAt(10));
    expect(first.status).toBe(201);
    const created = (await first.json()) as any;
    expect(created.status).toBe("BOOKED");
    expect(created.doctor.name).toBe("Dr. Default MD");

    // The same patient cannot hold two open appointments on one day, whatever the slot.
    const twice = await book(tomorrowAt(10, 15));
    expect(twice.status).toBe(409);
    expect(((await twice.json()) as any).error.message).toMatch(/already has an open appointment/);
    expect((await book(tomorrowAt(10), { doctorId: "rec_default" })).status).toBe(404); // receptionists cannot be booked

    // Another patient into the same slot: refused. Walk-ins are "now" and need no slot.
    const other = (await (await call("/patients", { method: "POST", headers: json(authedReception), body: JSON.stringify({ name: "Second Person", dob: "1985-02-02", gender: "MALE", phone: "9876511111" }) })).json()) as any;
    expect((await book(tomorrowAt(10), { patientId: other.id })).status).toBe(409);
    const walkIn = (await (await book(new Date(), { patientId: other.id, status: "WAITING" })).json()) as any; // "now" is inside the grace window
    expect(walkIn.status).toBe("WAITING");

    // Per-patient listing ignores the day window and returns newest first.
    const mine = (await (await call("/appointments?patientId=pat_test_1", { headers: authedReception })).json()) as any[];
    expect(mine.length).toBeGreaterThanOrEqual(2);
    expect(mine[0].scheduledAt >= mine[1].scheduledAt).toBe(true);

    const moved = await call(`/appointments/${created.id}`, {
      method: "PATCH",
      headers: json(authedReception),
      body: JSON.stringify({ scheduledAt: tomorrowAt(11).toISOString(), reason: "Check-up, moved" }),
    });
    expect(moved.status).toBe(200);
    expect(((await moved.json()) as any).reason).toBe("Check-up, moved");
    // Into a taken slot: refused.
    // Into a slot another patient holds: refused.
    // Cancelling the walk-in frees the other patient to be booked again that day.
    await call(`/appointments/${walkIn.id}`, { method: "PATCH", headers: json(authedReception), body: JSON.stringify({ status: "CANCELLED" }) });
    expect((await book(tomorrowAt(12), { patientId: other.id })).status).toBe(201);
    const clash = await call(`/appointments/${created.id}`, { method: "PATCH", headers: json(authedReception), body: JSON.stringify({ scheduledAt: tomorrowAt(12).toISOString() }) });
    expect(clash.status).toBe(409);
  });

  it("a BOOKED (not checked-in) patient does not hold up the queue; check-in does", async () => {
    const { id: second } = await prisma.appointment.create({
      data: { patientId: "pat_test_1", doctorId: "doc_default", scheduledAt: at(9), reason: "Later", status: "WAITING" },
    });
    const start = (id: string) => call(`/appointments/${id}`, { method: "PATCH", headers: json(authed), body: JSON.stringify({ status: "IN_CONSULTATION" }) });

    // 08:00 is BOOKED, so 09:00 (checked in) may go first.
    expect((await start(second)).status).toBe(200);
    expect((await call(`/appointments/${second}`, { method: "PATCH", headers: json(authed), body: JSON.stringify({ status: "WAITING" }) })).status).toBe(200);

    // Front desk checks 08:00 in: now 09:00 must wait.
    expect((await call(`/appointments/${appointmentId}`, { method: "PATCH", headers: json(authedReception), body: JSON.stringify({ status: "WAITING" }) })).status).toBe(200);
    const blocked = await start(second);
    expect(blocked.status).toBe(409);
    expect(((await blocked.json()) as any).error.code).toBe("QUEUE_ORDER");
  });
});
