import { describe, expect, test } from "bun:test";
import { findSpan, spansFor } from "../evidence";

const notes = "Marcus here for review. Reports itching rash on both forearms for 5 days, worse after showering, no fever. Plan: betamethasone 0.1% twice daily.";

describe("findSpan", () => {
  test("exact phrase, case-insensitive", () => {
    expect(findSpan(notes, "Itching rash on both forearms")).toEqual({ start: 32, end: 61 });
  });
  test("falls back to the longest 3+ word run when the model rephrased", () => {
    const s = findSpan(notes, "rash on both forearms, itchy");
    expect(s && notes.slice(s.start, s.end)).toBe("rash on both forearms");
  });
  test("returns null when nothing matches or the item is empty", () => {
    expect(findSpan(notes, "chest pain on exertion")).toBeNull();
    expect(findSpan(notes, "   ")).toBeNull();
  });
});

describe("spansFor", () => {
  test("merges overlapping spans and keeps document order", () => {
    const spans = spansFor(notes, ["no fever", "itching rash on both forearms", "rash on both forearms for 5 days"]);
    expect(spans.map((s) => notes.slice(s.start, s.end))).toEqual(["itching rash on both forearms for 5 days", "no fever"]);
  });
});
