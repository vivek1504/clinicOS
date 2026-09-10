"use client";

import { SparklesIcon } from "lucide-react";
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
}: {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
  hasDraft: boolean;
  notesChangedSinceDraft: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const problem = notesValidationMessage(value);
  const canGenerate = problem === null && !generating;
  const over = value.length > MAX_NOTES;

  return (
    <section
      aria-labelledby="notes-h"
      className="panel flex min-h-[420px] flex-col transition-shadow duration-200 focus-within:shadow-2 xl:h-full xl:min-h-0"
    >
      <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
        <div>
          <h2 id="notes-h" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Doctor notes
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">Document the consultation in your own words.</p>
        </div>
        <span className={`num mt-1 whitespace-nowrap text-[11px] ${over ? "font-medium text-danger-700" : "text-ink-4"}`} aria-live="polite">
          {value.length.toLocaleString()} / {MAX_NOTES.toLocaleString()}
        </span>
      </header>

      <label htmlFor="raw-notes" className="sr-only">
        Doctor notes
      </label>
      <textarea
        ref={textareaRef}
        id="raw-notes"
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
        className="min-h-0 flex-1 resize-none bg-transparent px-6 py-2 text-[15px] leading-[1.75] text-ink outline-none placeholder:text-ink-4"
      />

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
        <p id="raw-notes-hint" className="text-[12px] text-ink-3" aria-live="polite">
          {problem && value.trim().length > 0 ? (
            <span className="text-wait-700">{problem}</span>
          ) : notesChangedSinceDraft ? (
            <span className="text-ai-700">Notes changed since the draft was generated.</span>
          ) : (
            "AI will structure only information provided in your notes."
          )}
        </p>
        <Button variant="ai" onClick={onGenerate} disabled={!canGenerate} loading={generating} aria-describedby="raw-notes-hint">
          {generating ? null : <SparklesIcon />}
          {generating ? "Structuring…" : hasDraft ? "Regenerate structured note" : "Generate structured note"}
          {generating ? null : <kbd className="ml-1 hidden rounded-[3px] bg-white/15 px-1 font-sans text-[10px] font-medium text-white/80 sm:inline">⌘↵</kbd>}
        </Button>
      </footer>
    </section>
  );
}
