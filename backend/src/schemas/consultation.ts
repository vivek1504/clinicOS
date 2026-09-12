import { t } from "elysia";

// Generous for a note, tight enough that nobody posts a novel per field.
const Items = t.Array(t.String({ maxLength: 500 }), { maxItems: 100 });

export const StructuredNote = t.Object(
  {
    chiefComplaint: t.Nullable(t.String({ maxLength: 500 })),
    symptoms: Items,
    relevantHistory: Items,
    medicationsMentioned: Items,
    doctorPlan: Items,
    missingInformation: Items,
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
  aiModel: t.Optional(t.String({ maxLength: 120 })),
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
