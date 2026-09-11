"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangleIcon } from "lucide-react";
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
      className={`panel relative ${mode === "empty" ? "hidden md:flex lg:rounded-none lg:border-l lg:border-dashed lg:border-line-strong lg:bg-transparent lg:shadow-none" : "flex"} min-h-[280px] flex-col md:min-h-[420px] overflow-hidden transition-shadow duration-300 xl:h-full xl:min-h-0 ${
        mode === "running" || (mode === "draft" && aiGenerated) ? "ai-surface" : ""
      } ${mode === "running" ? "shadow-ai" : ""}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
        <div>
          <h2 id="ai-h" className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {mode === "draft" && !aiGenerated ? "Structured note" : "Structured draft"}
            {mode === "draft" && !aiGenerated ? null : <AiMark />}
          </h2>
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
            <Processing onCancel={onCancel} />
          ) : mode === "error" && ai.status === "error" ? (
            <Failed code={ai.code} onRetry={onRetry} onContinueWithoutAi={onContinueWithoutAi} />
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
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-8 text-center lg:items-start lg:justify-start lg:pt-2 lg:text-left">
      <p className="text-[14px] font-medium text-ink-2">Structured draft appears here</p>
      <Button variant="ghost" size="sm" className="mt-4 -ml-3 text-ink-3 lg:mt-3" onClick={onWriteManually}>
        Or write it yourself
      </Button>
    </div>
  );
}

/** Progress, not telemetry: the doctor needs to know it is working, not how many seconds it took. */
function Processing({ onCancel }: { onCancel: () => void }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-1 flex-col px-6 pb-6">
      <div className="relative h-px w-full overflow-hidden bg-ai-100">
        <span className="absolute inset-y-0 left-0 w-1/4 animate-scan bg-gradient-to-r from-transparent via-ai-500 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <p className="text-[15px] font-medium text-ink">Structuring your notes…</p>
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
  onRetry,
  onContinueWithoutAi,
}: {
  code: string;
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
      <p className="mt-4 text-[12px] text-ink-3">Your notes are untouched.</p>
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
