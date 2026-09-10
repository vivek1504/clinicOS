import { LooseNoteSchema, StructuredNoteSchema, type StructuredNoteType } from "./schema";

function normalizeArray(items: unknown): string[] {
  let arr: string[] = [];
  if (items === null || items === undefined) {
    arr = [];
  } else if (typeof items === "string") {
    arr = [items];
  } else if (Array.isArray(items)) {
    arr = items.filter((x): x is string => typeof x === "string");
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of arr) {
    const trimmed = item.trim();
    if (trimmed.length === 0) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }
  return result;
}

export function normalizeNote(raw: unknown): StructuredNoteType {
  const loose = LooseNoteSchema.parse(raw);

  let chiefComplaint: string | null = null;
  if (typeof loose.chiefComplaint === "string") {
    const trimmed = loose.chiefComplaint.trim();
    chiefComplaint = trimmed.length > 0 ? trimmed : null;
  }

  const normalized = {
    chiefComplaint,
    symptoms: normalizeArray(loose.symptoms),
    relevantHistory: normalizeArray(loose.relevantHistory),
    medicationsMentioned: normalizeArray(loose.medicationsMentioned),
    doctorPlan: normalizeArray(loose.doctorPlan),
    missingInformation: normalizeArray(loose.missingInformation),
  };

  return StructuredNoteSchema.parse(normalized);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
