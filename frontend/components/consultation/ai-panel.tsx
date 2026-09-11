"use client";

import { useEffect, useState } from "react";
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
      className={`panel relative ${mode === "empty" ? "hidden md:flex" : "flex"} min-h-[280px] flex-col md:min-h-[420px] overflow-hidden transition-shadow duration-300 xl:h-full xl:min-h-0 ${
        mode === "running" || (mode === "draft" && aiGenerated) ? "ai-surface" : ""
      } ${mode === "running" ? "shadow-ai" : ""}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-4 px-6 pt-5 pb-3">
        <div>
          <h2 id="ai-h" className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {mode === "draft" && !aiGenerated ? "Structured note" : "Draft"}
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
      <p className="text-[15px] font-medium text-ink">Your draft appears here</p>
      <p className="mt-1.5 max-w-[300px] text-[13px] leading-relaxed text-ink-3">Structured from your notes. Editable until you save.</p>
      <Button variant="ghost" size="sm" className="mt-6 text-ink-3" onClick={onWriteManually}>
        Or write the structured note yourself
      </Button>
    </div>
  );
}

function Processing({ startedAt, onCancel }: { startedAt: number; onCancel: () => void }) {
  const [elapsed, setElapsed] = useState(0);

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
        <p className="text-[15px] font-medium text-ink">Structuring your notes…</p>
        <p className="num mt-1 text-[12px] text-ink-3">{elapsed.toFixed(0)}s</p>
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
