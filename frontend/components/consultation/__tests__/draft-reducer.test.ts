import { describe, expect, test } from "bun:test";
import type { AiStructureResponse } from "@/lib/api/types";
import { editorReducer, initialEditorState, type EditorState } from "../draft-reducer";

const response: AiStructureResponse = {
  draft: {
    chiefComplaint: "Cough",
    symptoms: ["dry cough", "wheeze"],
    relevantHistory: ["asthma"],
    medicationsMentioned: [],
    doctorPlan: ["increase ICS"],
    missingInformation: ["temperature"],
  },
  model: "fake",
  latencyMs: 12,
};

function withDraft(): EditorState {
  let s = initialEditorState("req-1");
  s = editorReducer(s, { type: "SET_RAW_NOTES", value: "2 wk dry cough, wheeze, asthma, inc ICS" });
  s = editorReducer(s, { type: "AI_START", startedAt: 0 });
  return editorReducer(s, { type: "AI_SUCCESS", response });
}

describe("editorReducer", () => {
  test("starts clean and becomes dirty when notes are typed", () => {
    const s0 = initialEditorState("req-1");
    expect(s0.dirty).toBe(false);
    const s1 = editorReducer(s0, { type: "SET_RAW_NOTES", value: "hello" });
    expect(s1.dirty).toBe(true);
    const s2 = editorReducer(s1, { type: "SET_RAW_NOTES", value: "   " });
    expect(s2.dirty).toBe(false);
  });

  test("AI_SUCCESS populates the form with ai-sourced fields and freezes the draft", () => {
    const s = withDraft();
    expect(s.ai).toEqual({ status: "done" });
    expect(s.aiDraft).toEqual(response.draft);
    expect(s.missingInformation).toEqual(["temperature"]);
    expect(s.aiMeta).toEqual({ model: "fake", latencyMs: 12 });
    expect(s.draft.chiefComplaint.source).toBe("ai");
    expect(s.draft.symptoms.every((i) => i.source === "ai")).toBe(true);
    expect(s.dirty).toBe(true);
  });

  test("editing an item flips it to doctor; adding creates doctor items; removing drops it", () => {
    const s = withDraft();
    const id = s.draft.symptoms[0].id;
    const edited = editorReducer(s, { type: "ITEM_EDIT", field: "symptoms", id, value: "dry cough at night" });
    expect(edited.draft.symptoms[0]).toEqual({ id, value: "dry cough at night", source: "doctor", edited: true });
    expect(edited.draft.symptoms[1].source).toBe("ai");

    const added = editorReducer(edited, { type: "ITEM_ADD", field: "doctorPlan", value: "  review 2 weeks " });
    expect(added.draft.doctorPlan.at(-1)).toMatchObject({ value: "review 2 weeks", source: "doctor" });

    const ignored = editorReducer(added, { type: "ITEM_ADD", field: "doctorPlan", value: "   " });
    expect(ignored).toBe(added);

    const removed = editorReducer(added, { type: "ITEM_REMOVE", field: "symptoms", id });
    expect(removed.draft.symptoms.map((i) => i.value)).toEqual(["wheeze"]);
  });

  test("chief complaint edit clears the ai badge", () => {
    const s = editorReducer(withDraft(), { type: "SET_CHIEF_COMPLAINT", value: "Cough for 2 weeks" });
    expect(s.draft.chiefComplaint).toMatchObject({ value: "Cough for 2 weeks", source: "doctor" });
  });

  test("changing notes after a draft sets notesChangedSinceDraft; regenerating clears it", () => {
    const s = editorReducer(withDraft(), { type: "SET_RAW_NOTES", value: "different notes here" });
    expect(s.notesChangedSinceDraft).toBe(true);
    const again = editorReducer(editorReducer(s, { type: "AI_START", startedAt: 1 }), { type: "AI_SUCCESS", response });
    expect(again.notesChangedSinceDraft).toBe(false);
  });

  test("AI_ERROR then AI_DISMISS returns to idle without touching the form", () => {
    let s = editorReducer(initialEditorState("r"), { type: "SET_RAW_NOTES", value: "some notes that are long enough" });
    s = editorReducer(s, { type: "AI_START", startedAt: 0 });
    s = editorReducer(s, { type: "AI_ERROR", code: "AI_TIMEOUT", message: "timeout" });
    expect(s.ai).toEqual({ status: "error", code: "AI_TIMEOUT", message: "timeout" });
    s = editorReducer(s, { type: "AI_DISMISS" });
    expect(s.ai).toEqual({ status: "idle" });
    expect(s.aiDraft).toBeNull();
  });

  test("AI_CANCEL keeps an existing draft", () => {
    let s = editorReducer(withDraft(), { type: "AI_START", startedAt: 5 });
    s = editorReducer(s, { type: "AI_CANCEL" });
    expect(s.ai).toEqual({ status: "done" });
    expect(s.aiDraft).toEqual(response.draft);
  });

  test("RESTORE adopts the persisted clientRequestId so retries stay idempotent", () => {
    const snap = withDraft();
    const restored = editorReducer(initialEditorState("fresh"), {
      type: "RESTORE",
      snapshot: {
        clientRequestId: snap.clientRequestId,
        rawNotes: snap.rawNotes,
        draft: snap.draft,
        aiDraft: snap.aiDraft,
        missingInformation: snap.missingInformation,
        aiMeta: snap.aiMeta,
        savedAt: 1,
      },
    });
    expect(restored.clientRequestId).toBe("req-1");
    expect(restored.dirty).toBe(true);
    expect(restored.ai).toEqual({ status: "done" });
  });

  test("MARK_SAVED clears dirty", () => {
    expect(editorReducer(withDraft(), { type: "MARK_SAVED" }).dirty).toBe(false);
  });
});
