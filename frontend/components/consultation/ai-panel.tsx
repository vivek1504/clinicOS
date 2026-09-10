"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangleIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPRING } from "@/components/shared/reveal";
import { AiMark } from "@/components/shared/source-mark";
import { aiErrorCopy } from "@/lib/ai-error-messages";
import type { AiStatus } from "./draft-reducer";

export type AiPanelMode = "empty" | "running" | "error" | "draft";

export function AiPanel({
  mode,
  ai,
  aiGenerated,
  onCancel,
  onRetry,
  onContinueWithoutAi,
  onWriteManually,
  children,
}: {
  mode: AiPanelMode;
  ai: AiStatus;
  /** False while the doctor is writing the structured note by hand. */
  aiGenerated: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onContinueWithoutAi: () => void;
  onWriteManually: () => void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <section
      aria-labelledby="ai-h"
      aria-busy={mode === "running" || undefined}
      className={`panel relative flex min-h-[420px] flex-col overflow-hidden transition-shadow duration-300 xl:h-full xl:min-h-0 ${
        mode === "running" || (mode === "draft" && aiGenerated) ? "ai-surface" : ""
      } ${mode === "running" ? "shadow-ai" : ""}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
        <div>
          <h2 id="ai-h" className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {mode === "draft" && !aiGenerated ? "Structured note" : "AI structured note"}
            {mode === "draft" && !aiGenerated ? null : <AiMark />}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {mode === "draft"
              ? aiGenerated
                ? "Editable. Your changes are marked as yours."
                : "Written by you. Generate from your notes at any time."
              : "What the AI structured from your notes."}
          </p>
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.14 } }}
          transition={SPRING}
          className="flex min-h-0 flex-1 flex-col xl:overflow-y-auto"
        >
          {mode === "empty" ? (
            <Empty onWriteManually={onWriteManually} />
          ) : mode === "running" && ai.status === "running" ? (
            <Processing startedAt={ai.startedAt} onCancel={onCancel} />
          ) : mode === "error" && ai.status === "error" ? (
            <Failed code={ai.code} message={ai.message} onRetry={onRetry} onContinueWithoutAi={onContinueWithoutAi} />
          ) : (
            children
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function Empty({ onWriteManually }: { onWriteManually: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-10 text-center">
      <Glyph />
      <p className="mt-7 text-[15px] font-medium text-ink">Your structured draft appears here</p>
      <p className="mt-1.5 max-w-[300px] text-[13px] leading-relaxed text-ink-3">
        Write your notes, then generate. The draft stays fully editable until you save it.
      </p>
      <Button variant="ghost" size="sm" className="mt-6 text-ink-3" onClick={onWriteManually}>
        Or write the structured note yourself
      </Button>
    </div>
  );
}

/** Abstract "clinical intelligence" mark: concentric arcs, no icons, no imagery. */
function Glyph({ active = false }: { active?: boolean }) {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true" className="text-ai-300">
      <circle cx="60" cy="60" r="56" stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 6" />
      <circle
        cx="60"
        cy="60"
        r="42"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeDasharray="60 200"
        strokeLinecap="round"
        className={active ? "origin-center animate-[spin_3.2s_linear_infinite]" : "origin-center animate-[spin_24s_linear_infinite]"}
      />
      <circle
        cx="60"
        cy="60"
        r="28"
        stroke="currentColor"
        strokeDasharray="30 150"
        strokeLinecap="round"
        className={active ? "origin-center animate-[spin_2.1s_linear_infinite_reverse]" : "origin-center animate-[spin_18s_linear_infinite_reverse]"}
      />
      <circle cx="60" cy="60" r="4" fill="currentColor" className="text-ai-500" />
    </svg>
  );
}

const STEPS = ["Extracting symptoms", "Identifying relevant history", "Organizing treatment plan"];

function Processing({ startedAt, onCancel }: { startedAt: number; onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  // Steps advance on a clock; the last one stays live until the response lands. Honest about what it is: a progress cue, not telemetry.
  const step = Math.min(Math.floor(elapsed / 1.4), STEPS.length - 1);

  useEffect(() => {
    const id = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 100);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col px-6 pb-6">
      <div className="relative h-px w-full overflow-hidden bg-ai-100">
        <span className="absolute inset-y-0 left-0 w-1/4 animate-scan bg-gradient-to-r from-transparent via-ai-500 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <Glyph active />
        <p className="mt-7 text-[15px] font-medium text-ink">Structuring consultation…</p>
        <p className="num mt-1 text-[12px] text-ink-4">{elapsed.toFixed(0)}s</p>

        <ol className="mt-7 w-full max-w-[280px] space-y-2.5 text-left">
          {STEPS.map((label, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <li key={label} className="flex items-center gap-3 text-[13px]">
                <span
                  className={`flex size-4 items-center justify-center rounded-full border transition-colors duration-300 ${
                    state === "done"
                      ? "border-ai-500 bg-ai-500 text-white"
                      : state === "active"
                        ? "border-ai-500"
                        : "border-line-strong"
                  }`}
                  aria-hidden="true"
                >
                  {state === "done" ? <CheckIcon className="size-2.5" strokeWidth={3} /> : state === "active" ? <span className="size-1.5 rounded-full bg-ai-500 animate-pulse" /> : null}
                </span>
                <span className={`transition-colors duration-300 ${state === "pending" ? "text-ink-4" : "text-ink"}`}>{label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" className="text-ink-3" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Failed({
  code,
  message,
  onRetry,
  onContinueWithoutAi,
}: {
  code: string;
  message: string;
  onRetry: () => void;
  onContinueWithoutAi: () => void;
}) {
  const copy = aiErrorCopy(code);
  return (
    <div role="alert" className="flex flex-1 flex-col items-center justify-center px-8 pb-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-wait-100 text-wait-700">
        <AlertTriangleIcon className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-5 text-[15px] font-medium text-ink">{copy.title}</p>
      <p className="mt-1.5 max-w-[320px] text-[13px] leading-relaxed text-ink-3">{copy.body}</p>
      {message && code !== "AI_UNAVAILABLE" && code !== "NETWORK" ? (
        <p className="mt-3 max-w-[360px] rounded-md bg-surface-2 px-3 py-1.5 font-mono text-[11px] text-ink-3">{message}</p>
      ) : null}
      <p className="mt-4 text-[12px] text-ink-4">Your notes are untouched.</p>
      <div className="mt-6 flex gap-2">
        <Button variant="ai" size="sm" onClick={onRetry}>
          Retry
        </Button>
        <Button variant="secondary" size="sm" onClick={onContinueWithoutAi}>
          Continue without AI
        </Button>
      </div>
    </div>
  );
}
