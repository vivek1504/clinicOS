import type { AiStructureResponse, StructuredNote } from "@/lib/api/types";
import {
  aiMetaFrom,
  emptyDraft,
  fromAiDraft,
  hasFormContent,
  newId,
  type AiMeta,
  type DraftListField,
  type NoteDraft,
} from "./draft-model";

export type AiStatus =
  | { status: "idle" }
  | { status: "running"; startedAt: number }
  | { status: "error"; code: string; message: string }
  | { status: "done" };

export interface PersistedDraft {
  clientRequestId: string;
  rawNotes: string;
  draft: NoteDraft;
  aiDraft: StructuredNote | null;
  missingInformation: string[];
  aiMeta: AiMeta | null;
  savedAt: number;
}

export interface EditorState {
  clientRequestId: string;
  rawNotes: string;
  draft: NoteDraft;
  /** Frozen copy of what the model returned; null when AI was not used. */
  aiDraft: StructuredNote | null;
  missingInformation: string[];
  aiMeta: AiMeta | null;
  ai: AiStatus;
  /** Raw notes were edited after the current draft was generated. */
  notesChangedSinceDraft: boolean;
  dirty: boolean;
}

export type EditorAction =
  | { type: "SET_RAW_NOTES"; value: string }
  | { type: "AI_START"; startedAt: number }
  | { type: "AI_SUCCESS"; response: AiStructureResponse }
  | { type: "AI_ERROR"; code: string; message: string }
  | { type: "AI_CANCEL" }
  | { type: "AI_DISMISS" }
  | { type: "SET_CHIEF_COMPLAINT"; value: string }
  | { type: "ITEM_ADD"; field: DraftListField; value: string }
  | { type: "ITEM_EDIT"; field: DraftListField; id: string; value: string }
  | { type: "ITEM_REMOVE"; field: DraftListField; id: string }
  | { type: "RESTORE"; snapshot: PersistedDraft }
  | { type: "MARK_SAVED" };

export function initialEditorState(clientRequestId: string = newId()): EditorState {
  return {
    clientRequestId,
    rawNotes: "",
    draft: emptyDraft(),
    aiDraft: null,
    missingInformation: [],
    aiMeta: null,
    ai: { status: "idle" },
    notesChangedSinceDraft: false,
    dirty: false,
  };
}

function hasContent(s: EditorState): boolean {
  return s.rawNotes.trim().length > 0 || hasFormContent(s.draft) || s.aiDraft !== null;
}

function withDirty(s: EditorState): EditorState {
  return { ...s, dirty: hasContent(s) };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_RAW_NOTES":
      return withDirty({
        ...state,
        rawNotes: action.value,
        notesChangedSinceDraft: state.aiDraft !== null && action.value !== state.rawNotes,
      });

    case "AI_START":
      return { ...state, ai: { status: "running", startedAt: action.startedAt } };

    case "AI_SUCCESS":
      return withDirty({
        ...state,
        ai: { status: "done" },
        aiDraft: action.response.draft,
        draft: fromAiDraft(action.response.draft),
        missingInformation: action.response.draft.missingInformation,
        aiMeta: aiMetaFrom(action.response),
        notesChangedSinceDraft: false,
      });

    case "AI_ERROR":
      return { ...state, ai: { status: "error", code: action.code, message: action.message } };

    case "AI_CANCEL":
    case "AI_DISMISS":
      return { ...state, ai: state.aiDraft ? { status: "done" } : { status: "idle" } };

    case "SET_CHIEF_COMPLAINT":
      return withDirty({
        ...state,
        draft: {
          ...state.draft,
          chiefComplaint: {
            value: action.value,
            source: "doctor",
            edited: state.draft.chiefComplaint.source === "ai" || state.draft.chiefComplaint.edited,
          },
        },
      });

    case "ITEM_ADD": {
      const value = action.value.trim();
      if (!value) return state;
      return withDirty({
        ...state,
        draft: {
          ...state.draft,
          [action.field]: [...state.draft[action.field], { id: newId(), value, source: "doctor" }],
        },
      });
    }

    case "ITEM_EDIT":
      return withDirty({
        ...state,
        draft: {
          ...state.draft,
          [action.field]: state.draft[action.field].map((item) =>
            item.id === action.id
              ? { ...item, value: action.value, source: "doctor", edited: item.source === "ai" || item.edited }
              : item,
          ),
        },
      });

    case "ITEM_REMOVE":
      return withDirty({
        ...state,
        draft: {
          ...state.draft,
          [action.field]: state.draft[action.field].filter((item) => item.id !== action.id),
        },
      });

    case "RESTORE":
      return withDirty({
        ...state,
        clientRequestId: action.snapshot.clientRequestId,
        rawNotes: action.snapshot.rawNotes,
        draft: action.snapshot.draft,
        aiDraft: action.snapshot.aiDraft,
        missingInformation: action.snapshot.missingInformation,
        aiMeta: action.snapshot.aiMeta,
        ai: action.snapshot.aiDraft ? { status: "done" } : { status: "idle" },
        notesChangedSinceDraft: false,
      });

    case "MARK_SAVED":
      return { ...state, dirty: false };

    default:
      return state;
  }
}

export function toPersisted(s: EditorState): PersistedDraft {
  return {
    clientRequestId: s.clientRequestId,
    rawNotes: s.rawNotes,
    draft: s.draft,
    aiDraft: s.aiDraft,
    missingInformation: s.missingInformation,
    aiMeta: s.aiMeta,
    savedAt: Date.now(),
  };
}
