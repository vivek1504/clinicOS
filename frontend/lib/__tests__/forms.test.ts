import { describe, expect, test } from "bun:test";
import { bookingSchema, fieldErrors, patientSchema, signInSchema } from "../forms";

const pad = (n: number) => String(n).padStart(2, "0");
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

describe("signInSchema", () => {
  test("names the field that is wrong", () => {
    expect(fieldErrors(signInSchema, { email: "not-an-email", password: "" })).toEqual({ email: "Enter a valid email address", password: "Enter your password" });
    expect(fieldErrors(signInSchema, { email: " a@b.co ", password: "x" })).toBeNull();
  });
});

describe("patientSchema", () => {
  const ok = { name: "Asha Sharma", dob: "1988-04-12", gender: "FEMALE", phone: "9876543210", allergies: [], conditions: [] };
  test("accepts a normal patient and rejects a future birth date and a letter-filled phone", () => {
    expect(fieldErrors(patientSchema, ok)).toBeNull();
    expect(fieldErrors(patientSchema, { ...ok, dob: "2999-01-01" })?.dob).toBe("Date of birth can't be in the future");
    expect(fieldErrors(patientSchema, { ...ok, phone: "call me" })?.phone).toBe("Enter a 10-digit mobile number");
    expect(fieldErrors(patientSchema, { ...ok, phone: "98765" })?.phone).toBe("Enter a 10-digit mobile number");
    expect(fieldErrors(patientSchema, { ...ok, name: "A" })?.name).toMatch(/full name/);
    expect(fieldErrors(patientSchema, { ...ok, gender: "" })?.gender).toBe("Choose a gender");
  });
});

describe("bookingSchema", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const base = { patientId: "p", doctorId: "d", walkIn: false, date: local(tomorrow), time: "10:30", reason: "Check-up" };
  test("accepts a future slot, rejects a past one unless it is a walk-in", () => {
    expect(fieldErrors(bookingSchema, base)).toBeNull();
    const past = { ...base, date: "2020-01-01" };
    expect(fieldErrors(bookingSchema, past)?.time).toBe("That time has already passed");
    expect(fieldErrors(bookingSchema, { ...past, walkIn: true })).toBeNull();
  });
  test("keeps scheduled times on the quarter hour, but not walk-ins", () => {
    expect(fieldErrors(bookingSchema, { ...base, time: "10:20" })?.time).toMatch(/15-minute/);
    expect(fieldErrors(bookingSchema, { ...base, time: "10:20", walkIn: true })).toBeNull();
  });
  test("requires a patient and a reason", () => {
    expect(fieldErrors(bookingSchema, { ...base, patientId: "", reason: "  " })).toEqual({ patientId: "Choose a patient", reason: "Say why the patient is coming in" });
  });
});
