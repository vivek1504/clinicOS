import { describe, expect, test } from "bun:test";
import type { AppointmentDto } from "../api/types";
import { todaysVisit } from "../visit";

const appt = (id: string, status: AppointmentDto["status"], patientId = "p1") => ({ id, status, patientId } as AppointmentDto);

describe("todaysVisit", () => {
  test("a completed appointment is recorded; an open one is not; no appointment is never blocked", () => {
    expect(todaysVisit({ patientId: "p1", appointments: [appt("a1", "COMPLETED")] })).toEqual({ recorded: true, appointment: appt("a1", "COMPLETED"), blockedBy: null });
    expect(todaysVisit({ patientId: "p1", appointments: [appt("a1", "IN_CONSULTATION")] }).recorded).toBe(false);
    expect(todaysVisit({ patientId: "p1", appointments: [] })).toEqual({ recorded: false, appointment: null, blockedBy: null });
  });

  test("prefers the URL's appointment, then the patient's open one, ignoring other patients", () => {
    const appointments = [appt("other", "WAITING", "p2"), appt("done", "COMPLETED"), appt("open", "WAITING")];
    expect(todaysVisit({ patientId: "p1", appointmentId: "done", appointments }).recorded).toBe(true);
    expect(todaysVisit({ patientId: "p1", appointments }).appointment?.id).toBe("open");
    expect(todaysVisit({ patientId: "p3", appointments }).appointment).toBeNull();
  });
});

describe("blockedBy", () => {
  const row = (id: string, status: AppointmentDto["status"], hour: number, patientId = id) =>
    ({ id, status, patientId, scheduledAt: `2026-09-11T${String(hour).padStart(2, "0")}:00:00.000Z` } as AppointmentDto);

  test("the earliest unfinished earlier appointment blocks; completed ones and later ones do not", () => {
    const rows = [row("a", "COMPLETED", 8), row("b", "WAITING", 9), row("c", "WAITING", 10), row("d", "WAITING", 11)];
    expect(todaysVisit({ patientId: "b", appointments: rows }).blockedBy).toBeNull();
    expect(todaysVisit({ patientId: "c", appointments: rows }).blockedBy?.id).toBe("b");
    expect(todaysVisit({ patientId: "d", appointments: rows }).blockedBy?.id).toBe("b");
  });

  test("a no-show neither blocks nor is blocked; it is not startable until the front desk checks it in", () => {
    const rows = [row("a", "NO_SHOW", 8), row("b", "WAITING", 9), row("c", "WAITING", 10)];
    expect(todaysVisit({ patientId: "b", appointments: rows }).blockedBy).toBeNull();
    expect(todaysVisit({ patientId: "c", appointments: rows }).blockedBy?.id).toBe("b");
    expect(todaysVisit({ patientId: "a", appointments: rows }).blockedBy).toBeNull();
  });

  test("a BOOKED patient who has not checked in does not hold up those behind and is not startable", () => {
    const rows = [row("a", "BOOKED", 8), row("b", "WAITING", 9), row("c", "BOOKED", 10), row("x", "CANCELLED", 7)];
    expect(todaysVisit({ patientId: "b", appointments: rows }).blockedBy).toBeNull();
    expect(todaysVisit({ patientId: "c", appointments: rows }).blockedBy).toBeNull();
    expect(todaysVisit({ patientId: "x", appointments: rows }).appointment).toBeNull();
  });

  test("whoever is in the room wins over queue order, and the room holder is never blocked", () => {
    const rows = [row("a", "WAITING", 8), row("b", "IN_CONSULTATION", 9), row("c", "WAITING", 10)];
    expect(todaysVisit({ patientId: "c", appointments: rows }).blockedBy?.id).toBe("b");
    expect(todaysVisit({ patientId: "b", appointments: rows }).blockedBy).toBeNull();
    expect(todaysVisit({ patientId: "zz", appointments: rows }).blockedBy).toBeNull();
  });
});
