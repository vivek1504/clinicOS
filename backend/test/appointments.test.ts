import { describe, it, expect, beforeEach } from "bun:test";
import { buildApp } from "../src/app";
import { FakeAiProvider } from "../src/ai/fake.provider";
import { authed, authedReception, resetTestDb } from "./helpers/db";
import { prisma } from "../src/lib/prisma";

const app = buildApp({ ai: new FakeAiProvider() });

const patch = (id: string, status: string, headers: Record<string, string> = authed) =>
  app.handle(
    new Request(`http://localhost/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ status }),
    })
  );

const at = (hour: number) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
};

describe("Room and queue rules", () => {
  let first: string; // 08:00
  let second: string; // 09:00

  beforeEach(async () => {
    const { doctor, patient, appointment } = await resetTestDb();
    first = appointment.id;
    await prisma.appointment.update({ where: { id: first }, data: { scheduledAt: at(8) } });
    const other = await prisma.appointment.create({
      data: { patientId: patient.id, doctorId: doctor.id, scheduledAt: at(9), reason: "Follow-up", status: "WAITING" },
    });
    second = other.id;
  });

  it("the second patient cannot start until the first has finished", async () => {
    const early = await patch(second, "IN_CONSULTATION");
    expect(early.status).toBe(409);
    const body = (await early.json()) as any;
    expect(body.error.code).toBe("QUEUE_ORDER");
    expect(body.error.details.appointmentId).toBe(first);

    expect((await patch(first, "IN_CONSULTATION")).status).toBe(200);
    const blocked = await patch(second, "IN_CONSULTATION");
    expect(blocked.status).toBe(409);
    expect(((await blocked.json()) as any).error.code).toBe("ALREADY_IN_CONSULTATION");

    // Re-entering your own room is a no-op; stepping out frees the room but the queue still holds.
    expect((await patch(first, "IN_CONSULTATION")).status).toBe(200);
    expect((await patch(first, "WAITING")).status).toBe(200);
    expect(((await (await patch(second, "IN_CONSULTATION")).json()) as any).error.code).toBe("QUEUE_ORDER");

    expect((await patch(first, "COMPLETED")).status).toBe(200);
    expect((await patch(second, "IN_CONSULTATION")).status).toBe(200);
  });

  it("a no-show leaves the queue without moving anyone's time; coming back re-joins it", async () => {
    expect((await patch(first, "NO_SHOW")).status).toBe(403); // doctors do not mark absent
    expect((await patch(first, "NO_SHOW", authedReception)).status).toBe(200);
    expect((await patch(second, "IN_CONSULTATION")).status).toBe(200);
    expect((await patch(second, "WAITING")).status).toBe(200);

    // The 08:00 patient turns up after all: only the front desk can put them back; then they are ahead of 09:00 again.
    expect((await patch(first, "WAITING")).status).toBe(403);
    expect((await patch(first, "WAITING", authedReception)).status).toBe(200);
    expect(((await (await patch(second, "IN_CONSULTATION")).json()) as any).error.code).toBe("QUEUE_ORDER");
    expect((await patch(first, "NO_SHOW", authedReception)).status).toBe(200);
    // A returning no-show is checked in by the front desk, then the doctor starts them.
    expect((await patch(first, "IN_CONSULTATION")).status).toBe(409); // still NO_SHOW: never legal for a doctor
    expect((await patch(first, "WAITING", authedReception)).status).toBe(200);
    expect((await patch(first, "IN_CONSULTATION")).status).toBe(200);
    expect(((await (await patch(second, "IN_CONSULTATION")).json()) as any).error.code).toBe("ALREADY_IN_CONSULTATION");
  });

  it("two simultaneous starts yield exactly one 200 and one 409", async () => {
    const results = await Promise.all([patch(first, "IN_CONSULTATION"), patch(second, "IN_CONSULTATION")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("saving a consultation for a WAITING appointment respects the room and the queue", async () => {
    const note = { chiefComplaint: "x", symptoms: [], relevantHistory: [], medicationsMentioned: [], doctorPlan: [], missingInformation: [] };
    const save = (appointmentId: string, clientRequestId: string) =>
      app.handle(
        new Request("http://localhost/consultations", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authed },
          body: JSON.stringify({ patientId: "pat_test_1", appointmentId, clientRequestId, rawNotes: "notes", aiDraft: null, finalNote: note, wasAiUsed: false, wasAiEdited: false }),
        })
      );

    let res = await save(second, "0f3f4b8e-2f7b-4c8d-9d3e-1a2b3c4d5e6f");
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error.code).toBe("QUEUE_ORDER");

    expect((await patch(first, "IN_CONSULTATION")).status).toBe(200);
    res = await save(second, "1f3f4b8e-2f7b-4c8d-9d3e-1a2b3c4d5e6f");
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error.code).toBe("ALREADY_IN_CONSULTATION");

    expect((await save(first, "2f3f4b8e-2f7b-4c8d-9d3e-1a2b3c4d5e6f")).status).toBe(201);
    expect((await save(second, "3f3f4b8e-2f7b-4c8d-9d3e-1a2b3c4d5e6f")).status).toBe(201);
  });
});
