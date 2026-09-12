"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { findSpan, spansFor } from "@/lib/evidence";
import { AiPanel, type AiPanelMode } from "./ai-panel";
import { ContextRail } from "./context-rail";
import { hasFormContent, isEdited, toFinalNote } from "./draft-model";
import { editorReducer, initialEditorState } from "./draft-reducer";
import { NotesPanel } from "./notes-panel";
import { notesValidationMessage } from "./notes-validation";
import { SaveBar } from "./save-bar";
import { SavedState } from "./saved-state";
import { StructuredDraft } from "./structured-draft";
import { useDraftPersistence } from "./use-draft-persistence";
import { useTranscription } from "./use-transcription";
import { useUnsavedGuard } from "./use-unsaved-guard";

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Details the backend attaches to ALREADY_IN_CONSULTATION and QUEUE_ORDER, plus its one-line reason. */
interface Blocker {
  appointmentId?: string;
  patientId?: string;
  patientName?: string;
  message: string;
}

export function ConsultationWorkspace({
  patient,
  history,
  appointmentId,
  voiceEnabled = false,
}: {
  patient: PatientDto;
  history: ConsultationDto[];
  appointmentId?: string;
  /** The server has AssemblyAI configured, so the notes panel offers Record. */
  voiceEnabled?: boolean;
}) {
  const [state, dispatch] = useReducer(editorReducer, undefined, () => initialEditorState());
  const [manual, setManual] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmNotesOnly, setConfirmNotesOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [blockedBy, setBlockedBy] = useState<Blocker | null>(null);
  const [flash, setFlash] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const heldRoom = useRef(false);
  const savedRef = useRef(false);

  const router = useGuardedRouter();
  const voice = useTranscription({ onFinal: (text) => dispatch({ type: "APPEND_RAW_NOTES", text }) });
  const { pending, clear: clearPersisted, dismissPending } = useDraftPersistence(patient.id, appointmentId, state);
  useUnsavedGuard(state.dirty && !saving && !saved);

  // sessionStorage is per tab, so a recent snapshot is this doctor's own work from a moment ago: bring it back without asking.
  useEffect(() => {
    if (pending && Date.now() - pending.savedAt < 6 * 60 * 60 * 1000) {
      dispatch({ type: "RESTORE", snapshot: pending });
      dismissPending();
    }
  }, [pending, dismissPending]);

  // Arriving from the schedule: take the room. Only one patient can be in consultation at a time, and the
  // backend enforces that; here we just show who holds it. Leaving without saving gives the room back.
  useEffect(() => {
    if (!appointmentId) return;
    let cancelled = false;
    patchAppointmentStatus(appointmentId, "IN_CONSULTATION")
      .then(() => {
        if (!cancelled) heldRoom.current = true;
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.code === "ALREADY_IN_CONSULTATION" || err.code === "QUEUE_ORDER")) {
          setBlockedBy({ ...(err.details as Omit<Blocker, "message"> | undefined), message: err.message });
        }
        // Any other failure is not the doctor's problem.
      });
    return () => {
      cancelled = true;
      if (heldRoom.current && !savedRef.current) patchAppointmentStatus(appointmentId, "WAITING").catch(() => {});
      heldRoom.current = false;
    };
  }, [appointmentId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Focus mode: while a consultation is open the site footer steps back. The attribute is styled in globals.css.
  useEffect(() => {
    document.documentElement.dataset.focus = "consultation";
    return () => {
      delete document.documentElement.dataset.focus;
    };
  }, []);

  // The transformation: when a draft lands, the phrases it was built from light up in the notes for a moment.
  const aiValues = useMemo(() => {
    const d = state.draft;
    return [d.chiefComplaint, ...d.symptoms, ...d.relevantHistory, ...d.medicationsMentioned, ...d.doctorPlan].filter((i) => i.source === "ai").map((i) => i.value);
  }, [state.draft]);
  const highlights = useMemo(() => (flash ? spansFor(state.rawNotes, aiValues) : []), [flash, state.rawNotes, aiValues]);
  const activeSpan = useMemo(() => (activeItem ? findSpan(state.rawNotes, activeItem) : null), [activeItem, state.rawNotes]);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(false), 1200);
    return () => clearTimeout(id);
  }, [flash]);

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
      setFlash(true);
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
  const canSave = !saving && blockedBy === null && (state.rawNotes.trim().length > 0 || hasFormContent(state.draft));

  const doSave = useCallback(async () => {
    if (saving || !canSave) return;
    voice.stop();
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
      savedRef.current = true;
      setSaved(true);
      // No router.refresh() here: it would re-run this page's server component, which now sees a completed
      // appointment and redirects away before the saved state is seen. Every page fetches fresh on navigation anyway.
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSaveError(err instanceof ApiError ? err : new ApiError("UNKNOWN", "Unexpected error", 0));
    } finally {
      setSaving(false);
    }
  }, [appointmentId, canSave, clearPersisted, finalNote, patient.id, saving, state, voice, wasAiUsed]);

  /** A note with no structured content is legal, but the record will look empty; say so once. */
  const save = useCallback(() => {
    if (saving || !canSave) return;
    if (!hasFormContent(state.draft)) {
      setConfirmNotesOnly(true);
      return;
    }
    void doSave();
  }, [canSave, doSave, saving, state.draft]);

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
        : state.aiDraft !== null || manual || hasFormContent(state.draft) || state.previous !== null
          ? "draft"
          : "empty";

  if (saved) {
    return <SavedState patientName={patient.name} patientId={patient.id} linkedToAppointment={Boolean(appointmentId)} note={finalNote} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-5 xl:-mb-16 xl:h-[calc(100dvh-84px)] xl:flex-none">
      <div className="flex flex-col gap-3">
        <SafeLink
          href={`/patients/${patient.id}`}
          className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeftIcon className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
          {patient.name}
        </SafeLink>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="display text-[26px] text-ink">New consultation</h1>
            <p className="text-[13px] text-ink-3" suppressHydrationWarning>
              {LONG_DATE.format(new Date())}
            </p>
          </div>
          {appointmentId ? <StatusBadge status="IN_CONSULTATION" /> : <span className="text-[13px] text-ink-3">Unscheduled visit</span>}
        </div>
      </div>

      {blockedBy ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-wait-100 px-4 py-3 text-[13px] text-ink">
          <span>
            <span className="font-medium">{blockedBy.message}.</span>{" "}
            <span className="text-ink-2">Finish their consultation first. Saving is disabled here until then.</span>
          </span>
          {blockedBy.patientId && blockedBy.appointmentId ? (
            <Button
              size="sm"
              variant="secondary"
              render={<SafeLink href={`/patients/${blockedBy.patientId}/consultation?appointmentId=${encodeURIComponent(blockedBy.appointmentId)}`} />}
            >
              Go to their consultation
            </Button>
          ) : null}
        </div>
      ) : null}

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

      {/* Desktop columns follow the task: writing gets the room until a draft exists, then reviewing does. The shift is the transformation. */}
      <div
        className={`grid items-start gap-5 xl:min-h-0 xl:flex-1 xl:items-stretch motion-safe:transition-[grid-template-columns] motion-safe:duration-500 motion-safe:ease-out ${
          mode === "empty"
            ? "md:grid-cols-[minmax(0,1fr)_200px] xl:grid-cols-[200px_minmax(0,1fr)_260px]"
            : "md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] xl:grid-cols-[200px_minmax(0,2fr)_minmax(0,3fr)]"
        }`}
      >
        <ContextRail patient={patient} history={history} className="md:col-span-2 xl:col-span-1" />

        <NotesPanel
          value={state.rawNotes}
          onChange={(v) => dispatch({ type: "SET_RAW_NOTES", value: v })}
          onGenerate={generate}
          generating={state.ai.status === "running"}
          hasDraft={state.aiDraft !== null}
          notesChangedSinceDraft={state.notesChangedSinceDraft}
          textareaRef={notesRef}
          highlights={highlights}
          activeSpan={activeSpan}
          voice={
            voiceEnabled
              ? { status: voice.status, partial: voice.partial, error: voice.error, startedAt: voice.startedAt, analyser: voice.analyser, device: voice.device, silent: voice.silent, onToggle: () => (voice.status === "idle" ? voice.start() : voice.stop()) }
              : undefined
          }
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
            onChiefComplaint={(v) => dispatch({ type: "SET_CHIEF_COMPLAINT", value: v })}
            onItemAdd={(field, value) => dispatch({ type: "ITEM_ADD", field, value })}
            onItemEdit={(field, id, value) => dispatch({ type: "ITEM_EDIT", field, id, value })}
            onItemRemove={(field, id) => dispatch({ type: "ITEM_REMOVE", field, id })}
            onRestorePrevious={state.previous ? () => dispatch({ type: "RESTORE_PREVIOUS" }) : undefined}
            onItemFocus={setActiveItem}
            draftVersion={state.draftVersion}
            firstFieldRef={firstFieldRef}
          />
        </AiPanel>
      </div>

      <SaveBar
        dirty={state.dirty}
        canSave={canSave}
        saving={saving}
        error={saveError}
        onSave={() => void save()}
        onDiscard={() => (state.dirty ? setConfirmDiscard(true) : discard())}
      />

      <ConfirmDialog
        open={confirmRegenerate}
        title="Structure the notes again?"
        body="A new draft replaces the current one. The current draft, including your edits, stays one click away until you save."
        confirmLabel="Structure again"
        onConfirm={() => {
          setConfirmRegenerate(false);
          void runGenerate();
        }}
        onCancel={() => setConfirmRegenerate(false)}
      />

      <ConfirmDialog
        open={confirmNotesOnly}
        title="Save with notes only?"
        body="The structured note is empty, so this visit will show no chief complaint, symptoms or plan on the record. Your notes are kept in full."
        confirmLabel="Save notes only"
        onConfirm={() => {
          setConfirmNotesOnly(false);
          void doSave();
        }}
        onCancel={() => setConfirmNotesOnly(false)}
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
