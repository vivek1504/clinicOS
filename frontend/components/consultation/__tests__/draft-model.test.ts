import { describe, expect, test } from "bun:test";
import type { StructuredNote } from "@/lib/api/types";
import {
  countUnreviewedAi,
  emptyDraft,
  fromAiDraft,
  hasFormContent,
  isEdited,
  normalizeList,
  toFinalNote,
} from "../draft-model";

const note: StructuredNote = {
  chiefComplaint: "Sore throat",
  symptoms: ["fever", "sore throat"],
  relevantHistory: [],
  medicationsMentioned: ["paracetamol"],
  doctorPlan: ["fluids"],
  missingInformation: ["duration"],
};

describe("fromAiDraft", () => {
  test("tags every populated field as ai", () => {
    const d = fromAiDraft(note);
    expect(d.chiefComplaint).toEqual({ value: "Sore throat", source: "ai" });
    expect(d.symptoms.map((i) => i.source)).toEqual(["ai", "ai"]);
    expect(d.relevantHistory).toEqual([]);
    expect(countUnreviewedAi(d)).toBe(5);
  });

  test("null chief complaint stays unpopulated", () => {
    const d = fromAiDraft({ ...note, chiefComplaint: null });
    expect(d.chiefComplaint).toEqual({ value: "", source: null });
  });
});

describe("normalizeList", () => {
  test("trims, drops empties and dedupes case-insensitively keeping first spelling", () => {
    expect(normalizeList(["  Fever ", "", "fever", "FEVER", "cough"])).toEqual(["Fever", "cough"]);
  });
});

describe("toFinalNote", () => {
  test("strips metadata and normalizes", () => {
    const d = fromAiDraft(note);
    d.symptoms.push({ id: "x", value: "  Fever ", source: "doctor" });
    d.symptoms.push({ id: "y", value: "   ", source: "doctor" });
    const final = toFinalNote(d, ["duration"]);
    expect(final).toEqual({ ...note, symptoms: ["fever", "sore throat"] });
  });

  test("empty chief complaint becomes null", () => {
    const final = toFinalNote(emptyDraft(), []);
    expect(final.chiefComplaint).toBeNull();
    expect(final.symptoms).toEqual([]);
  });
});

describe("isEdited", () => {
  test("false for an untouched draft", () => {
    expect(isEdited(note, toFinalNote(fromAiDraft(note), note.missingInformation))).toBe(false);
  });

  test("false after a whitespace-only edit (normalization parity with the backend)", () => {
    const d = fromAiDraft(note);
    d.symptoms[0] = { ...d.symptoms[0], value: "  fever ", source: "doctor" };
    expect(isEdited(note, toFinalNote(d, note.missingInformation))).toBe(false);
  });

  test("true after a real edit", () => {
    const d = fromAiDraft(note);
    d.doctorPlan.push({ id: "z", value: "review in 3 days", source: "doctor" });
    expect(isEdited(note, toFinalNote(d, note.missingInformation))).toBe(true);
  });
});

describe("hasFormContent", () => {
  test("empty draft has no content; whitespace does not count", () => {
    const d = emptyDraft();
    expect(hasFormContent(d)).toBe(false);
    d.symptoms.push({ id: "a", value: "  ", source: "doctor" });
    expect(hasFormContent(d)).toBe(false);
    d.chiefComplaint = { value: "x", source: "doctor" };
    expect(hasFormContent(d)).toBe(true);
  });
});
