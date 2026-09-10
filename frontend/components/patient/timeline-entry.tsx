"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPRING } from "@/components/shared/reveal";
import { AiMark } from "@/components/shared/source-mark";
import { StructuredNoteView } from "@/components/shared/structured-note-view";
import type { ConsultationDto } from "@/lib/api/types";
import { formatDate } from "@/lib/format";


export function TimelineEntry({ consultation: c, index }: { consultation: ConsultationDto; index: number }) {
  const [open, setOpen] = useState(false);
  const [compare, setCompare] = useState(false);
  const panelId = useId();
  const reduce = useReducedMotion();
  const title = c.finalNote.chiefComplaint ?? c.chiefComplaint ?? null;
  const notePreview = c.rawNotes.replace(/\s+/g, " ").trim();

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: Math.min(index, 10) * 0.05 }}
      className="grid grid-cols-1 border-b border-line last:border-0 md:grid-cols-[6.5rem_1.5rem_1fr]"
    >
      <time dateTime={c.createdAt} className="num pt-5 font-mono text-[12px] font-medium tracking-[0.06em] text-ink-3 uppercase md:pt-6">
        {formatDate(c.createdAt)}
      </time>

      <span aria-hidden="true" className="relative hidden justify-center pt-[26px] md:flex">
        <span className={`relative z-10 block size-2.5 rounded-full border-2 ${index === 0 ? "border-ink bg-ink" : "border-ink-4 bg-surface"}`} />
      </span>

      <div className="min-w-0 md:pl-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="group -mx-3 flex w-[calc(100%+1.5rem)] items-start gap-4 rounded-lg px-3 py-4 text-left transition-colors duration-150 hover:bg-surface-2/70 active:bg-surface-2 active:duration-0 md:py-5"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-medium tracking-[-0.01em] text-ink">
              {title ?? <span className="font-normal text-ink-4 italic">No chief complaint recorded</span>}
            </p>
            <p className={`mt-1 text-[13px] leading-relaxed text-ink-3 ${open ? "" : "line-clamp-2"}`}>{notePreview}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-ink-3">
              {c.wasAiUsed ? (
                <span className="inline-flex items-center gap-1.5">
                  <AiMark />
                  {c.wasAiEdited ? "AI-assisted, reviewed by doctor" : "AI-assisted"}
                </span>
              ) : (
                <span>Written by doctor</span>
              )}
              {c.finalNote.doctorPlan.length > 0 ? (
                <span className="text-ink-4">
                  {c.finalNote.doctorPlan.length} plan {c.finalNote.doctorPlan.length === 1 ? "item" : "items"}
                </span>
              ) : null}
            </div>
          </div>
          <ChevronDownIcon
            className={`mt-1.5 size-4 shrink-0 text-ink-4 transition-transform duration-200 group-hover:text-ink ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id={panelId}
              key="panel"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? undefined : { height: 0, opacity: 0 }}
              transition={SPRING}
              className="overflow-hidden"
            >
              <div className="pb-6">
                {compare && c.aiDraft ? (
                  <div className="grid gap-px overflow-hidden rounded-lg bg-line shadow-1 lg:grid-cols-2">
                    <section className="ai-surface p-5">
                      <p className="mb-4 inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.08em] text-ai-700 uppercase">
                        <AiMark />
                        AI draft as generated
                      </p>
                      <StructuredNoteView note={c.aiDraft} compact />
                    </section>
                    <section className="bg-surface p-5">
                      <p className="mb-4 text-[11px] font-medium tracking-[0.08em] text-accent-700 uppercase">Saved note · changes marked</p>
                      <StructuredNoteView note={c.finalNote} highlightDiffFrom={c.aiDraft} showMissing={false} compact />
                    </section>
                  </div>
                ) : (
                  <div className="panel p-5 sm:p-6">
                    <StructuredNoteView note={c.finalNote} showMissing={false} />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
                  {c.aiDraft ? (
                    <Button size="sm" variant="ghost" className="-ml-2" onClick={() => setCompare((v) => !v)}>
                      {compare ? "Hide AI draft" : "Compare with AI draft"}
                    </Button>
                  ) : (
                    <span />
                  )}
                  {c.aiModel ? (
                    <span className="num">
                      {c.aiModel}
                      {c.aiLatencyMs != null ? ` · ${(c.aiLatencyMs / 1000).toFixed(1)}s` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}
