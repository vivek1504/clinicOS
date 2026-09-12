"use client";

import { AlertTriangleIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SPRING_QUICK } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api/client";

/** Persistence only. Whether the draft is reviewed is the draft header's business. */
export function SaveBar({
  dirty,
  canSave,
  saving,
  error,
  onSave,
  onDiscard,
}: {
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  error: ApiError | null;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="chrome sticky bottom-0 z-20 -mx-5 mt-2 border-t border-line/80 px-5 py-3 sm:-mx-8 sm:px-8 xl:mt-0">
      <div className="mx-auto flex w-full max-w-[1920px] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3" aria-live="polite">
          {error ? (
            <span role="alert" className="inline-flex items-center gap-1.5 font-medium text-danger-700">
              <AlertTriangleIcon className="size-4 shrink-0" aria-hidden="true" />
              {error.code === "CONFLICT"
                ? "This appointment already has a saved consultation. Open the patient page to see it."
                : `Could not save: ${error.message}. Your edits are kept.`}
            </span>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {saving || dirty ? (
                  <motion.span key="state" layout={!reduce} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={SPRING_QUICK} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={`size-1.5 rounded-full transition-colors duration-300 ${saving ? "bg-accent-500 animate-pulse-dot" : "bg-wait-700"}`} />
                    {saving ? "Saving…" : "Unsaved"}
                  </motion.span>
                ) : null}
                <motion.span key="hint" layout={!reduce} transition={SPRING_QUICK} className="hidden items-center gap-1 text-ink-3 lg:inline-flex">
                  <kbd className="rounded-[3px] bg-surface px-1.5 py-px font-sans text-[11px] shadow-hair">⌘S</kbd> to save
                </motion.span>
              </AnimatePresence>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          <Button onClick={onSave} disabled={!canSave} loading={saving} className="min-w-[164px]">
            {error ? "Retry save" : "Save consultation"}
          </Button>
        </div>
      </div>
    </div>
  );
}
