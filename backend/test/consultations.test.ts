import { describe, it, expect, beforeEach } from "bun:test";
import { ConsultationService } from "../src/services/consultation.service";
import { AppError } from "../src/lib/errors";
import { prisma } from "../src/lib/prisma";
import { resetTestDb } from "./helpers/db";

describe("ConsultationService (Database and Idempotency)", () => {
  let patientId: string;
  let appointmentId: string;
  let service: ConsultationService;

  beforeEach(async () => {
    const { patient, appointment } = await resetTestDb();
    patientId = patient.id;
    appointmentId = appointment.id;
    service = new ConsultationService();
  });

  it("creates consultation, returns 201, and updates appointment status to COMPLETED", async () => {
    const note = {
      chiefComplaint: "Mild fever",
      symptoms: ["fever"],
      relevantHistory: [],
      medicationsMentioned: ["paracetamol"],
      doctorPlan: ["rest"],
      missingInformation: [],
    };

    const res = await service.create({
      patientId,
      appointmentId,
      clientRequestId: "b21845bb-428d-4e94-9b2f-2c3bfa097a81",
      rawNotes: "Patient has mild fever. Take paracetamol.",
      aiDraft: note,
      finalNote: note,
      wasAiUsed: true,
      wasAiEdited: false,
    }, "doc_default");

    expect(res.status).toBe(201);
    expect(res.consultation.id).toBeDefined();
    expect(res.consultation.patientId).toBe(patientId);
    expect(res.consultation.appointmentId).toBe(appointmentId);

    // Verify appointment flipped to COMPLETED
    const updatedAppt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    expect(updatedAppt?.status).toBe("COMPLETED");
  });

  it("same clientRequestId twice returns 200 with identical id without creating a second row", async () => {
    const note = {
      chiefComplaint: "Dry cough",
      symptoms: ["cough"],
      relevantHistory: [],
      medicationsMentioned: [],
      doctorPlan: ["hydration"],
      missingInformation: [],
    };

    const reqId = "7a4192fc-5a82-4c2a-9cc2-bf80c85023fa";

    const res1 = await service.create({
      patientId,
      appointmentId,
      clientRequestId: reqId,
      rawNotes: "Dry cough",
      aiDraft: note,
      finalNote: note,
      wasAiUsed: true,
      wasAiEdited: false,
    }, "doc_default");

    expect(res1.status).toBe(201);

    const res2 = await service.create({
      patientId,
      appointmentId,
      clientRequestId: reqId,
      rawNotes: "Dry cough",
      aiDraft: note,
      finalNote: note,
      wasAiUsed: true,
      wasAiEdited: false,
    }, "doc_default");

    expect(res2.status).toBe(200);
    expect(res2.consultation.id).toBe(res1.consultation.id);

    const count = await prisma.consultation.count({
      where: { clientRequestId: reqId },
    });
    expect(count).toBe(1);
  });

  it("two different requests for the same appointmentId returns CONFLICT", async () => {
    const note = {
      chiefComplaint: "Headache",
      symptoms: ["headache"],
      relevantHistory: [],
      medicationsMentioned: [],
      doctorPlan: ["sleep"],
      missingInformation: [],
    };

    await service.create({
      patientId,
      appointmentId,
      clientRequestId: "88888888-428d-4e94-9b2f-2c3bfa097a81",
      rawNotes: "Headache notes",
      aiDraft: note,
      finalNote: note,
      wasAiUsed: true,
      wasAiEdited: false,
    }, "doc_default");

    try {
      await service.create({
        patientId,
        appointmentId,
        clientRequestId: "99999999-428d-4e94-9b2f-2c3bfa097a81",
        rawNotes: "Second attempt notes",
        aiDraft: note,
        finalNote: note,
        wasAiUsed: true,
        wasAiEdited: false,
      }, "doc_default");
      expect().fail("Should have thrown CONFLICT");
    } catch (err: any) {
      expect(err).toBeInstanceOf(AppError);
      expect(err.code).toBe("CONFLICT");
    }
  });

  it("forces wasAiEdited to true when draft and finalNote differ", async () => {
    const draft = {
      chiefComplaint: "Rash",
      symptoms: ["rash"],
      relevantHistory: [],
      medicationsMentioned: [],
      doctorPlan: ["cream"],
      missingInformation: [],
    };

    const finalNote = {
      chiefComplaint: "Severe Contact Dermatitis Rash",
      symptoms: ["erythematous rash"],
      relevantHistory: ["latex exposure"],
      medicationsMentioned: ["hydrocortisone 1%"],
      doctorPlan: ["apply hydrocortisone BID", "avoid latex"],
      missingInformation: [],
    };

    const res = await service.create({
      patientId,
      clientRequestId: "11111111-428d-4e94-9b2f-2c3bfa097a81",
      rawNotes: "Severe rash on hands.",
      aiDraft: draft,
      finalNote,
      wasAiUsed: true,
      wasAiEdited: false, // client reported false, but service must override
    }, "doc_default");

    expect(res.status).toBe(201);
    expect(res.consultation.wasAiEdited).toBe(true);
  });
});
