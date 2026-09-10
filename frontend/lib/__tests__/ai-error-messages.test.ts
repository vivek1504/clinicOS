import { describe, expect, test } from "bun:test";
import { aiErrorCopy } from "../ai-error-messages";

describe("aiErrorCopy", () => {
  test("every backend AI code has specific copy", () => {
    for (const code of ["AI_TIMEOUT", "AI_RATE_LIMITED", "AI_INVALID_OUTPUT", "AI_UNAVAILABLE"]) {
      const copy = aiErrorCopy(code);
      expect(copy.title).not.toBe("Something went wrong");
      expect(copy.body.length).toBeGreaterThan(0);
    }
  });

  test("unknown codes fall back", () => {
    expect(aiErrorCopy("WHATEVER").title).toBe("Something went wrong");
  });
});
