import { t } from "elysia";

export const StructuredNote = t.Object(
  {
    chiefComplaint: t.Nullable(t.String()),
    symptoms: t.Array(t.String()),
    relevantHistory: t.Array(t.String()),
    medicationsMentioned: t.Array(t.String()),
    doctorPlan: t.Array(t.String()),
    missingInformation: t.Array(t.String()),
  },
  { additionalProperties: false }
);

export const CreateConsultationBody = t.Object({
  patientId: t.String(),
  appointmentId: t.Optional(t.String()),
  clientRequestId: t.String({ format: "uuid" }),
  rawNotes: t.String({ minLength: 1, maxLength: 5000 }),
  aiDraft: t.Nullable(StructuredNote),
  finalNote: StructuredNote,
  aiModel: t.Optional(t.String()),
  aiLatencyMs: t.Optional(t.Integer({ minimum: 0 })),
  wasAiUsed: t.Boolean(),
  wasAiEdited: t.Boolean(),
});

export const UpdateConsultationBody = t.Partial(
  t.Object({
    finalNote: StructuredNote,
    rawNotes: t.String({ minLength: 1, maxLength: 5000 }),
  })
);

export const ConsultationDto = t.Object({
  id: t.String(),
  patientId: t.String(),
  doctorId: t.String(),
  appointmentId: t.Nullable(t.String()),
  clientRequestId: t.Nullable(t.String()),
  createdAt: t.String(),
  rawNotes: t.String(),
  aiDraft: t.Nullable(StructuredNote),
  finalNote: StructuredNote,
  aiModel: t.Nullable(t.String()),
  aiLatencyMs: t.Nullable(t.Integer()),
  wasAiUsed: t.Boolean(),
  wasAiEdited: t.Boolean(),
  chiefComplaint: t.Optional(t.Nullable(t.String())),
});
