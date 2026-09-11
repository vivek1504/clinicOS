"use client";

import { useRef } from "react";
import { SparklesIcon } from "lucide-react";
import type { Span } from "@/lib/evidence";
import { Button } from "@/components/ui/button";
import { MAX_NOTES, notesValidationMessage } from "./notes-validation";

const PLACEHOLDER =
  "Describe the patient's symptoms, relevant history, medications mentioned, examination findings, and plan…";

export function NotesPanel({
  value,
  onChange,
  onGenerate,
  generating,
  hasDraft,
  notesChangedSinceDraft,
  textareaRef,
  highlights = [],
  activeSpan = null,
}: {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
  hasDraft: boolean;
  notesChangedSinceDraft: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Phrases the draft was built from; shown briefly when a draft lands. */
  highlights?: Span[];
  /** The phrase behind the draft row the doctor is on. */
  activeSpan?: Span | null;
}) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const spans = [...highlights, ...(activeSpan ? [activeSpan] : [])].sort((a, b) => a.start - b.start);
  const showMirror = spans.length > 0;
  // Same text as the textarea, laid out identically, with marks where the draft's phrases live.
  const segments: React.ReactNode[] = [];
  let pos = 0;
  spans.forEach((s, i) => {
    if (s.start < pos) return;
    if (s.start > pos) segments.push(value.slice(pos, s.start));
    const active = activeSpan && s.start === activeSpan.start && s.end === activeSpan.end;
    segments.push(
      <mark key={i} className={`rounded-[3px] text-transparent transition-colors duration-500 ${active ? "bg-ai-200" : "bg-ai-100"}`}>
        {value.slice(s.start, s.end)}
      </mark>,
    );
    pos = s.end;
  });
  if (pos < value.length) segments.push(value.slice(pos));

  const problem = notesValidationMessage(value);
  const canGenerate = problem === null && !generating;
  const over = value.length > MAX_NOTES;

  return (
    <section
      aria-labelledby="notes-h"
      className="panel flex min-h-[60dvh] flex-col md:min-h-[420px] transition-[box-shadow] duration-200 focus-within:shadow-2 focus-within:ring-1 focus-within:ring-accent-500/30 xl:h-full xl:min-h-0"
    >
      <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
        <div>
          <h2 id="notes-h" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Doctor notes
          </h2>
        </div>
        {value.length > MAX_NOTES * 0.8 ? (
          <span className={`num mt-1 whitespace-nowrap text-[11px] ${over ? "font-medium text-danger-700" : "text-ink-3"}`} aria-live="polite">
            {value.length.toLocaleString()} / {MAX_NOTES.toLocaleString()}
          </span>
        ) : null}
      </header>

      <label htmlFor="raw-notes" className="sr-only">
        Doctor notes
      </label>
      <div className="relative min-h-0 flex-1">
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 overflow-hidden px-6 py-3 text-[16px] leading-[1.8] whitespace-pre-wrap break-words text-transparent transition-opacity duration-700 ${showMirror ? "opacity-100" : "opacity-0"}`}
        >
          {segments}
        </div>
      <textarea
        ref={textareaRef}
        id="raw-notes"
        onScroll={(e) => {
          if (mirrorRef.current) mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canGenerate) {
            e.preventDefault();
            onGenerate();
          }
        }}
        placeholder={PLACEHOLDER}
        maxLength={MAX_NOTES + 500}
        aria-describedby="raw-notes-hint"
        aria-invalid={over || undefined}
        className="relative h-full w-full resize-none bg-transparent px-6 py-3 text-[16px] leading-[1.8] text-ink outline-none placeholder:text-ink-4"
      />
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
        <p id="raw-notes-hint" className="text-[12px] text-ink-3" aria-live="polite">
          {problem && value.trim().length > 0 ? (
            <span className="text-wait-700">{problem}</span>
          ) : notesChangedSinceDraft ? (
            <span className="text-ai-700">Notes changed since the draft was generated.</span>
          ) : null}
        </p>
        <Button variant="ai" onClick={onGenerate} disabled={!canGenerate} loading={generating} aria-describedby="raw-notes-hint">
          {generating ? null : <SparklesIcon />}
          {generating ? "Structuring…" : hasDraft ? "Structure again" : "Structure notes"}
          {generating ? null : <kbd className="ml-1 hidden rounded-[3px] bg-white/15 px-1 font-sans text-[10px] font-medium text-white/80 sm:inline">⌘↵</kbd>}
        </Button>
      </footer>
    </section>
  );
}
