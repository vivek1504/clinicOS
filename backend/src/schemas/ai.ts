import { t } from "elysia";
import { StructuredNote } from "./consultation";

export const StructureConsultationBody = t.Object({
  rawNotes: t.String({ minLength: 20, maxLength: 5000 }),
  patientId: t.String(),
});

export const PatientSummaryBody = t.Object({ patientId: t.String() });

export const PatientSummaryResponse = t.Object({
  summary: t.String(),
  model: t.String(),
  latencyMs: t.Integer(),
  /** How many saved consultations the summary was written from. */
  basedOn: t.Integer(),
});

export const StructureConsultationResponse = t.Object({
  draft: StructuredNote,
  model: t.String(),
  latencyMs: t.Integer(),
});
