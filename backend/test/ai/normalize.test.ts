import { describe, it, expect } from "bun:test";
import { normalizeNote } from "../../src/ai/normalize";

describe("normalizeNote", () => {
  it("converts null or missing array fields to empty arrays", () => {
    const raw = {
      chiefComplaint: null,
      symptoms: null,
      relevantHistory: null,
      medicationsMentioned: null,
      doctorPlan: null,
      missingInformation: null,
    };
    const result = normalizeNote(raw);
    expect(result.chiefComplaint).toBeNull();
    expect(result.symptoms).toEqual([]);
    expect(result.relevantHistory).toEqual([]);
    expect(result.medicationsMentioned).toEqual([]);
    expect(result.doctorPlan).toEqual([]);
    expect(result.missingInformation).toEqual([]);
  });

  it("coerces a single string into a single-element array", () => {
    const raw = {
      chiefComplaint: "Headache",
      symptoms: "throbbing pain",
      relevantHistory: "migraines",
      medicationsMentioned: "ibuprofen 400mg",
      doctorPlan: "rest in dark room",
      missingInformation: "blood pressure",
    };
    const result = normalizeNote(raw);
    expect(result.symptoms).toEqual(["throbbing pain"]);
    expect(result.relevantHistory).toEqual(["migraines"]);
    expect(result.medicationsMentioned).toEqual(["ibuprofen 400mg"]);
    expect(result.doctorPlan).toEqual(["rest in dark room"]);
    expect(result.missingInformation).toEqual(["blood pressure"]);
  });

  it("trims strings and drops empty or whitespace-only items", () => {
    const raw = {
      chiefComplaint: "   Fever and chills   ",
      symptoms: ["  fever  ", "", "   ", "chills"],
      relevantHistory: ["  "],
      medicationsMentioned: ["  paracetamol  "],
      doctorPlan: [],
      missingInformation: [],
    };
    const result = normalizeNote(raw);
    expect(result.chiefComplaint).toBe("Fever and chills");
    expect(result.symptoms).toEqual(["fever", "chills"]);
    expect(result.relevantHistory).toEqual([]);
    expect(result.medicationsMentioned).toEqual(["paracetamol"]);
  });

  it("deduplicates case-insensitively while preserving the first spelling", () => {
    const raw = {
      chiefComplaint: "Cough",
      symptoms: ["Cough", "cough", "COUGH", "Sore Throat", "sore throat"],
      relevantHistory: [],
      medicationsMentioned: ["Amoxicillin", "amoxicillin"],
      doctorPlan: [],
      missingInformation: [],
    };
    const result = normalizeNote(raw);
    expect(result.symptoms).toEqual(["Cough", "Sore Throat"]);
    expect(result.medicationsMentioned).toEqual(["Amoxicillin"]);
  });

  it("converts empty or whitespace-only chiefComplaint to null", () => {
    const raw1 = {
      chiefComplaint: "",
      symptoms: [],
      relevantHistory: [],
      medicationsMentioned: [],
      doctorPlan: [],
      missingInformation: [],
    };
    expect(normalizeNote(raw1).chiefComplaint).toBeNull();

    const raw2 = {
      chiefComplaint: "    ",
      symptoms: [],
      relevantHistory: [],
      medicationsMentioned: [],
      doctorPlan: [],
      missingInformation: [],
    };
    expect(normalizeNote(raw2).chiefComplaint).toBeNull();
  });

  it("rejects unknown keys with Zod validation error", () => {
    const raw = {
      chiefComplaint: "Cough",
      symptoms: [],
      relevantHistory: [],
      medicationsMentioned: [],
      doctorPlan: [],
      missingInformation: [],
      extraFieldNotAllowed: "invalid",
    };
    expect(() => normalizeNote(raw)).toThrow();
  });
});
