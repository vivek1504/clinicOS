import { describe, it, expect, beforeEach } from "bun:test";
import { AiService } from "../../src/services/ai.service";
import { FakeAiProvider } from "../../src/ai/fake.provider";
import { AppError } from "../../src/lib/errors";
import { resetTestDb } from "../helpers/db";

describe("AiService with FakeAiProvider", () => {
  let patientId: string;

  beforeEach(async () => {
    const { patient } = await resetTestDb();
    patientId = patient.id;
  });

  it("ok mode: returns a valid draft with latency and model populated", async () => {
    const fake = new FakeAiProvider({ mode: "ok", model: "fake-test-model" });
    const service = new AiService(fake);

    const res = await service.structureConsultation({
      rawNotes: "Patient has high fever and cough. Started paracetamol. Advised rest.",
      patientId,
    });

    expect(res.draft).toBeDefined();
    expect(res.draft.chiefComplaint).toBe("fever");
    expect(res.draft.symptoms).toContain("fever");
    expect(res.draft.symptoms).toContain("cough");
    expect(res.draft.medicationsMentioned).toContain("paracetamol");
    expect(res.model).toBe("fake-test-model");
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fake.calls.length).toBe(1);
    expect(fake.calls[0]!.repair).toBeUndefined();
  });

  it("fenced mode: strips markdown code fences and parses valid JSON", async () => {
    const fake = new FakeAiProvider({ mode: "fenced" });
    const service = new AiService(fake);

    const res = await service.structureConsultation({
      rawNotes: "Patient reports severe headache and nausea.",
      patientId,
    });

    expect(res.draft.symptoms).toContain("headache");
    expect(fake.calls.length).toBe(1);
  });

  it("prose mode: extracts JSON embedded in surrounding text", async () => {
    const fake = new FakeAiProvider({ mode: "prose" });
    const service = new AiService(fake);

    const res = await service.structureConsultation({
      rawNotes: "Patient has mild sore throat and cough.",
      patientId,
    });

    expect(res.draft.symptoms).toContain("cough");
    expect(fake.calls.length).toBe(1);
  });

  it("invalid then ok mode: repair path succeeds, provider called twice with repair details", async () => {
    const fake = new FakeAiProvider({ modes: ["invalid", "ok"] });
    const service = new AiService(fake);

    const res = await service.structureConsultation({
      rawNotes: "Patient with rash on face.",
      patientId,
    });

    expect(res.draft.symptoms).toContain("rash");
    expect(fake.calls.length).toBe(2);
    expect(fake.calls[0]!.repair).toBeUndefined();
    expect(fake.calls[1]!.repair).toBeDefined();
    expect(fake.calls[1]!.repair?.previousOutput).toContain("disallowedExtraField");
    expect(fake.calls[1]!.repair?.problem).toBeDefined();
  });

  it("invalid twice mode: fails after repair attempt and throws AI_INVALID_OUTPUT", async () => {
    const fake = new FakeAiProvider({ modes: ["invalid", "invalid"] });
    const service = new AiService(fake);

    try {
      await service.structureConsultation({
        rawNotes: "Patient checkup notes",
        patientId,
      });
      expect().fail("Should have thrown AI_INVALID_OUTPUT");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("AI_INVALID_OUTPUT");
    }
    expect(fake.calls.length).toBe(2);
  });

  it("timeout error maps to AI_TIMEOUT without service-level retries", async () => {
    const fake = new FakeAiProvider({ mode: "timeout" });
    const service = new AiService(fake);

    try {
      await service.structureConsultation({
        rawNotes: "Patient notes",
        patientId,
      });
      expect().fail("Should have thrown AI_TIMEOUT");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("AI_TIMEOUT");
    }
    expect(fake.calls.length).toBe(1);
  });

  it("rate_limited error maps to AI_RATE_LIMITED without retries", async () => {
    const fake = new FakeAiProvider({ mode: "rate_limited" });
    const service = new AiService(fake);

    try {
      await service.structureConsultation({
        rawNotes: "Patient notes",
        patientId,
      });
      expect().fail("Should have thrown AI_RATE_LIMITED");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("AI_RATE_LIMITED");
    }
    expect(fake.calls.length).toBe(1);
  });

  it("unavailable error maps to AI_UNAVAILABLE without retries", async () => {
    const fake = new FakeAiProvider({ mode: "unavailable" });
    const service = new AiService(fake);

    try {
      await service.structureConsultation({
        rawNotes: "Patient notes",
        patientId,
      });
      expect().fail("Should have thrown AI_UNAVAILABLE");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("AI_UNAVAILABLE");
    }
    expect(fake.calls.length).toBe(1);
  });

  it("sparse notes fixture: leaves arrays empty and notes missing information (no invented data)", async () => {
    const sparseFixture = {
      chiefComplaint: "General checkup",
      symptoms: [],
      relevantHistory: [],
      medicationsMentioned: [],
      doctorPlan: ["routine blood tests"],
      missingInformation: ["blood pressure", "temperature", "heart rate", "allergies inquiry"],
    };

    const fake = new FakeAiProvider({ fixture: sparseFixture });
    const service = new AiService(fake);

    const res = await service.structureConsultation({
      rawNotes: "Patient in for general checkup. Ordered blood tests.",
      patientId,
    });

    expect(res.draft.symptoms).toEqual([]);
    expect(res.draft.relevantHistory).toEqual([]);
    expect(res.draft.medicationsMentioned).toEqual([]);
    expect(res.draft.missingInformation.length).toBeGreaterThan(0);
    expect(res.draft.missingInformation).toContain("blood pressure");
  });

  it("throws NOT_FOUND when patient does not exist", async () => {
    const fake = new FakeAiProvider({ mode: "ok" });
    const service = new AiService(fake);

    try {
      await service.structureConsultation({
        rawNotes: "Notes about unknown patient",
        patientId: "nonexistent_pat",
      });
      expect().fail("Should have thrown NOT_FOUND");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("NOT_FOUND");
    }
    expect(fake.calls.length).toBe(0);
  });
});
