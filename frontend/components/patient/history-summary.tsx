"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPRING } from "@/components/shared/reveal";
import { AiMark } from "@/components/shared/source-mark";
import { aiErrorCopy } from "@/lib/ai-error-messages";
import { AI_CANCELLED, summarizePatientHistory, type PatientSummaryResponse } from "@/lib/api/ai";
import { ApiError } from "@/lib/api/client";
import { pluralize } from "@/lib/format";

type State =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: PatientSummaryResponse }
  | { status: "error"; code: string };

/** On-demand AI summary of the saved timeline. Never persisted: it is a reading aid, not part of the record. */
export function HistorySummary({ patientId, visits }: { patientId: string; visits: number }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "running" });
    try {
      const result = await summarizePatientHistory(patientId, controller.signal);
      if (abortRef.current === controller) setState({ status: "done", result });
    } catch (err) {
      if (abortRef.current !== controller) return;
      if (err instanceof ApiError && err.code === AI_CANCELLED) return setState({ status: "idle" });
      setState({ status: "error", code: err instanceof ApiError ? err.code : "UNKNOWN" });
    }
  };

  return (
    <section aria-labelledby="summary-h" aria-busy={state.status === "running" || undefined} className={`mb-5 overflow-hidden rounded-lg bg-surface-2/60 ${state.status === "done" ? "ai-surface" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h3 id="summary-h" className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
            AI reading aid
            <AiMark />
          </h3>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {state.status === "done"
              ? `From ${pluralize(state.result.basedOn, "saved consultation")}. Not part of the record.`
              : `A short read of ${pluralize(visits, "saved visit")}.`}
          </p>
        </div>
        {state.status === "running" ? (
          <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
            Cancel
          </Button>
        ) : (
          <Button variant={state.status === "done" ? "ghost" : "ai"} size="sm" onClick={run}>
            {state.status !== "done" ? <SparklesIcon /> : null}
            {state.status === "done" ? "Regenerate" : state.status === "error" ? "Retry" : "Summarise history"}
          </Button>
        )}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {state.status === "running" ? (
          <motion.div key="running" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} className="border-t border-line px-5 py-4" role="status">
            <div className="space-y-2.5">
              <span className="skeleton block h-3.5 w-[92%]" />
              <span className="skeleton block h-3.5 w-[78%]" />
              <span className="skeleton block h-3.5 w-[60%]" />
            </div>
            <p className="mt-3 text-[12px] text-ink-3">Reading the saved consultations…</p>
          </motion.div>
        ) : state.status === "done" ? (
          <motion.div key="done" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={SPRING} className="border-t border-line px-5 py-4">
            <p className="max-w-3xl text-[15px] leading-[1.7] text-ink">{state.result.summary}</p>
          </motion.div>
        ) : state.status === "error" ? (
          <motion.div key="error" role="alert" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-t border-line px-5 py-4">
            <p className="text-[14px] font-medium text-ink">{aiErrorCopy(state.code).title}</p>
            <p className="mt-0.5 text-[13px] text-ink-3">The timeline below is unaffected.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
