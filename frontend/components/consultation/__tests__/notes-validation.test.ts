import { describe, expect, test } from "bun:test";
import { MAX_NOTES, notesValidationMessage } from "../notes-validation";

describe("notesValidationMessage", () => {
  test("empty, too short, valid, too long", () => {
    expect(notesValidationMessage("")).toBe("Type your notes first");
    expect(notesValidationMessage("short")).toMatch(/at least 20 characters/);
    expect(notesValidationMessage("a".repeat(20))).toBeNull();
    expect(notesValidationMessage("a".repeat(MAX_NOTES + 1))).toMatch(/Maximum 5000/);
  });
});
