import { z } from "zod";

export const StructuredNoteSchema = z
  .object({
    chiefComplaint: z.string().nullable(),
    symptoms: z.array(z.string()),
    relevantHistory: z.array(z.string()),
    medicationsMentioned: z.array(z.string()),
    doctorPlan: z.array(z.string()),
    missingInformation: z.array(z.string()),
  })
  .strict();

export type StructuredNoteType = z.infer<typeof StructuredNoteSchema>;

export const StructuredNoteJsonSchema = z.toJSONSchema(StructuredNoteSchema);

export const LooseNoteSchema = z
  .object({
    chiefComplaint: z.union([z.string(), z.null()]).optional(),
    symptoms: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
    relevantHistory: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
    medicationsMentioned: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
    doctorPlan: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
    missingInformation: z.union([z.array(z.string()), z.string(), z.null()]).optional(),
  })
  .strict();

export type LooseNoteType = z.infer<typeof LooseNoteSchema>;
