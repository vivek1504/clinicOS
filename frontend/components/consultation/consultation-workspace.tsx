"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SafeLink } from "@/components/shared/safe-link";
import { StatusBadge } from "@/components/shared/status-badge";
import { structureConsultation, AI_CANCELLED } from "@/lib/api/ai";
import { patchAppointmentStatus } from "@/lib/api/appointments";
import { ApiError } from "@/lib/api/client";
import { createConsultation } from "@/lib/api/consultations";
import type { ConsultationDto, PatientDto } from "@/lib/api/types";
import { useGuardedRouter } from "@/lib/navigation-blocker";
import { AiPanel, type AiPanelMode } from "./ai-panel";
import { ContextRail } from "./context-rail";
import { countUnreviewedAi, hasFormContent, isEdited, toFinalNote } from "./draft-model";
import { editorReducer, initialEditorState } from "./draft-reducer";
import { NotesPanel } from "./notes-panel";
import { notesValidationMessage } from "./notes-validation";
import { SaveBar } from "./save-bar";
import { SavedState } from "./saved-state";
import { StructuredDraft } from "./structured-draft";
import { useDraftPersistence } from "./use-draft-persistence";
import { useUnsavedGuard } from "./use-unsaved-guard";

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export function ConsultationWorkspace({
  patient,
  history,
  appointmentId,
}: {
  patient: PatientDto;
  history: ConsultationDto[];
  appointmentId?: string;
}) {
  const [state, dispatch] = useReducer(editorReducer, undefined, () => initialEditorState());
  const [manual, setManual] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const router = useGuardedRouter();
  const { pending, clear: clearPersisted, dismissPending } = useDraftPersistence(patient.id, appointmentId, state);
  useUnsavedGuard(state.dirty && !saving && !saved);

  // Arriving from the schedule: mark the appointment as in consultation. Failure here is not the doctor's problem.
  useEffect(() => {
    if (!appointmentId) return;
    patchAppointmentStatus(appointmentId, "IN_CONSULTATION").catch(() => {});
  }, [appointmentId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runGenerate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "AI_START", startedAt: Date.now() });
    try {
      const response = await structureConsultation({ rawNotes: state.rawNotes, patientId: patient.id }, controller.signal);
      if (abortRef.current !== controller) return;
      dispatch({ type: "AI_SUCCESS", response });
      setManual(false);
    } catch (err) {
      if (abortRef.current !== controller) return;
      if (err instanceof ApiError && err.code === AI_CANCELLED) {
        dispatch({ type: "AI_CANCEL" });
        return;
      }
      const code = err instanceof ApiError ? err.code : "UNKNOWN";
      const message = err instanceof Error ? err.message : "Unknown error";
      dispatch({ type: "AI_ERROR", code, message });
    }
  }, [patient.id, state.rawNotes]);

  const generate = useCallback(() => {
    if (notesValidationMessage(state.rawNotes) !== null || state.ai.status === "running") return;
    if (state.aiDraft !== null || hasFormContent(state.draft)) {
      setConfirmRegenerate(true);
      return;
    }
    void runGenerate();
  }, [runGenerate, state.ai.status, state.aiDraft, state.draft, state.rawNotes]);

  const cancelGenerate = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "AI_CANCEL" });
  };

  const finalNote = toFinalNote(state.draft, state.missingInformation);
  const wasAiUsed = state.aiDraft !== null;
  const canSave = !saving && (state.rawNotes.trim().length > 0 || hasFormContent(state.draft));

  const save = useCallback(async () => {
    if (saving || !canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await createConsultation({
        patientId: patient.id,
        appointmentId,
        clientRequestId: state.clientRequestId,
        rawNotes: state.rawNotes.trim() || "(no rough notes — structured note entered directly)",
        aiDraft: state.aiDraft,
        finalNote,
        aiModel: state.aiMeta?.model,
        aiLatencyMs: state.aiMeta?.latencyMs,
        wasAiUsed,
        wasAiEdited: wasAiUsed && state.aiDraft !== null && isEdited(state.aiDraft, finalNote),
      });
      clearPersisted();
      dispatch({ type: "MARK_SAVED" });
      setSaved(true);
      router.refresh(); // so the patient page and schedule reflect the new consultation on the next navigation
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err : new ApiError("UNKNOWN", "Unexpected error", 0));
    } finally {
      setSaving(false);
    }
  }, [appointmentId, canSave, clearPersisted, finalNote, patient.id, router, saving, state, wasAiUsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const discard = () => {
    clearPersisted();
    router.pushUnguarded(`/patients/${patient.id}`);
  };

  const mode: AiPanelMode =
    state.ai.status === "running"
      ? "running"
      : state.ai.status === "error"
        ? "error"
        : state.aiDraft !== null || manual || hasFormContent(state.draft)
          ? "draft"
          : "empty";

  if (saved) {
    return <SavedState patientName={patient.name} patientId={patient.id} linkedToAppointment={Boolean(appointmentId)} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 xl:-mb-16 xl:h-[calc(100dvh-84px)] xl:flex-none">
      <div className="flex flex-col gap-5">
        <SafeLink
          href={`/patients/${patient.id}`}
          className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeftIcon className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
          {patient.name}
        </SafeLink>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[36px] text-ink sm:text-[40px]">New consultation</h1>
            <p className="mt-1.5 text-[15px] text-ink-3" suppressHydrationWarning>
              {LONG_DATE.format(new Date())}
            </p>
          </div>
          {appointmentId ? <StatusBadge status="IN_CONSULTATION" className="mb-1.5" /> : <span className="mb-2 text-[13px] text-ink-4">Unscheduled visit</span>}
        </div>
      </div>

      {pending ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface px-4 py-3 text-[13px] text-ink shadow-1">
          <span>
            <span className="font-medium">An unsaved draft from an earlier session was found.</span>{" "}
            <span className="text-ink-3">Restore it or start fresh.</span>
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                dispatch({ type: "RESTORE", snapshot: pending });
                dismissPending();
              }}
            >
              Restore draft
            </Button>
            <Button size="sm" variant="ghost" onClick={clearPersisted}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)] xl:items-stretch">
        <ContextRail patient={patient} history={history} className="lg:col-span-2 xl:col-span-1" />

        <NotesPanel
          value={state.rawNotes}
          onChange={(v) => dispatch({ type: "SET_RAW_NOTES", value: v })}
          onGenerate={generate}
          generating={state.ai.status === "running"}
          hasDraft={state.aiDraft !== null}
          notesChangedSinceDraft={state.notesChangedSinceDraft}
          textareaRef={notesRef}
        />

        <AiPanel
          mode={mode}
          ai={state.ai}
          aiGenerated={state.aiDraft !== null}
          onCancel={cancelGenerate}
          onRetry={() => void runGenerate()}
          onContinueWithoutAi={() => {
            dispatch({ type: "AI_DISMISS" });
            setManual(true);
            requestAnimationFrame(() => firstFieldRef.current?.focus());
          }}
          onWriteManually={() => {
            setManual(true);
            requestAnimationFrame(() => firstFieldRef.current?.focus());
          }}
        >
          <StructuredDraft
            draft={state.draft}
            aiGenerated={state.aiDraft !== null}
            missingInformation={state.missingInformation}
            aiMeta={state.aiMeta}
            onChiefComplaint={(v) => dispatch({ type: "SET_CHIEF_COMPLAINT", value: v })}
            onItemAdd={(field, value) => dispatch({ type: "ITEM_ADD", field, value })}
            onItemEdit={(field, id, value) => dispatch({ type: "ITEM_EDIT", field, id, value })}
            onItemRemove={(field, id) => dispatch({ type: "ITEM_REMOVE", field, id })}
            firstFieldRef={firstFieldRef}
          />
        </AiPanel>
      </div>

      <SaveBar
        unreviewedAi={countUnreviewedAi(state.draft)}
        wasAiUsed={wasAiUsed}
        dirty={state.dirty}
        canSave={canSave}
        saving={saving}
        error={saveError}
        onSave={() => void save()}
        onDiscard={() => (state.dirty ? setConfirmDiscard(true) : discard())}
      />

      <ConfirmDialog
        open={confirmRegenerate}
        title="Replace the current draft?"
        body="The structured note, including your edits, will be replaced by a new draft generated from your notes."
        confirmLabel="Regenerate"
        destructive
        onConfirm={() => {
          setConfirmRegenerate(false);
          void runGenerate();
        }}
        onCancel={() => setConfirmRegenerate(false)}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this consultation?"
        body="Your notes and the structured draft will be lost. Nothing has been saved to the patient's history."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          discard();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}
