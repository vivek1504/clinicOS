import type { AiStructureResponse, StructuredNote } from "@/lib/api/types";

export type Source = "ai" | "doctor";

export interface Item {
  id: string;
  value: string;
  source: Source;
  /** True once the doctor has changed something the model drafted. Drives the "Doctor edited" tag. */
  edited?: boolean;
}

export interface ScalarField {
  value: string;
  /** null = never populated */
  source: Source | null;
  edited?: boolean;
}

export type DraftListField = "symptoms" | "relevantHistory" | "medicationsMentioned" | "doctorPlan";

export const DRAFT_LIST_FIELDS: { key: DraftListField; label: string; singular: string; hint: string }[] = [
  { key: "symptoms", label: "Symptoms", singular: "symptom", hint: "What the patient reports and what you observed" },
  { key: "relevantHistory", label: "Relevant history", singular: "history item", hint: "Past conditions, family or social history that matters here" },
  { key: "medicationsMentioned", label: "Medications mentioned", singular: "medication", hint: "Current, past or newly prescribed" },
  { key: "doctorPlan", label: "Doctor plan", singular: "plan item", hint: "Treatment, investigations, follow-up" },
];

export interface NoteDraft {
  chiefComplaint: ScalarField;
  symptoms: Item[];
  relevantHistory: Item[];
  medicationsMentioned: Item[];
  doctorPlan: Item[];
}

export interface AiMeta {
  model: string;
  latencyMs: number;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyDraft(): NoteDraft {
  return {
    chiefComplaint: { value: "", source: null },
    symptoms: [],
    relevantHistory: [],
    medicationsMentioned: [],
    doctorPlan: [],
  };
}

function itemsFrom(values: string[], source: Source): Item[] {
  return values.map((value) => ({ id: newId(), value, source }));
}

/** Every populated field is tagged as an AI draft. */
export function fromAiDraft(note: StructuredNote): NoteDraft {
  return {
    chiefComplaint: note.chiefComplaint
      ? { value: note.chiefComplaint, source: "ai" }
      : { value: "", source: null },
    symptoms: itemsFrom(note.symptoms, "ai"),
    relevantHistory: itemsFrom(note.relevantHistory, "ai"),
    medicationsMentioned: itemsFrom(note.medicationsMentioned, "ai"),
    doctorPlan: itemsFrom(note.doctorPlan, "ai"),
  };
}

/** Same rules as the backend normalizer: trim, drop empties, case-insensitive dedupe keeping first spelling. */
export function normalizeList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function normalizeNote(note: StructuredNote): StructuredNote {
  const cc = (note.chiefComplaint ?? "").trim();
  return {
    chiefComplaint: cc.length > 0 ? cc : null,
    symptoms: normalizeList(note.symptoms),
    relevantHistory: normalizeList(note.relevantHistory),
    medicationsMentioned: normalizeList(note.medicationsMentioned),
    doctorPlan: normalizeList(note.doctorPlan),
    missingInformation: normalizeList(note.missingInformation),
  };
}

/** Strips ids/sources and normalizes. `missingInformation` is carried over from the AI draft as a record of what was flagged. */
export function toFinalNote(draft: NoteDraft, missingInformation: string[]): StructuredNote {
  return normalizeNote({
    chiefComplaint: draft.chiefComplaint.value,
    symptoms: draft.symptoms.map((i) => i.value),
    relevantHistory: draft.relevantHistory.map((i) => i.value),
    medicationsMentioned: draft.medicationsMentioned.map((i) => i.value),
    doctorPlan: draft.doctorPlan.map((i) => i.value),
    missingInformation,
  });
}

export function isEdited(aiDraft: StructuredNote, finalNote: StructuredNote): boolean {
  return JSON.stringify(normalizeNote(aiDraft)) !== JSON.stringify(normalizeNote(finalNote));
}

export function hasFormContent(draft: NoteDraft): boolean {
  if (draft.chiefComplaint.value.trim()) return true;
  return DRAFT_LIST_FIELDS.some(({ key }) => draft[key].some((i) => i.value.trim().length > 0));
}

export function countItems(draft: NoteDraft): number {
  return DRAFT_LIST_FIELDS.reduce((n, { key }) => n + draft[key].length, 0);
}

export function countUnreviewedAi(draft: NoteDraft): number {
  const scalar = draft.chiefComplaint.source === "ai" ? 1 : 0;
  return scalar + DRAFT_LIST_FIELDS.reduce((n, { key }) => n + draft[key].filter((i) => i.source === "ai").length, 0);
}

export function aiMetaFrom(response: AiStructureResponse): AiMeta {
  return { model: response.model, latencyMs: response.latencyMs };
}
