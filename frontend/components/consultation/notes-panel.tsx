"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon, SparklesIcon, SquareIcon } from "lucide-react";
import type { Span } from "@/lib/evidence";
import { Button } from "@/components/ui/button";
import { MAX_NOTES, notesValidationMessage } from "./notes-validation";
import { LevelMeter } from "./level-meter";
import type { TranscriptionStatus } from "./use-transcription";

export interface VoiceControls {
  status: TranscriptionStatus;
  error: string | null;
  startedAt: number | null;
  /** Mic tap for the level bars while recording. */
  analyser: AnalyserNode | null;
  /** Label of the input device in use. */
  device: string | null;
  /** Nothing but silence has come in for a few seconds. */
  silent: boolean;
  onToggle: () => void;
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span className="num font-mono text-[12px] tabular-nums">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

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
  voice,
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
  /** Dictation controls; absent when the server has no transcription configured. */
  voice?: VoiceControls;
}) {
  const recording = voice?.status === "recording";
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
      <mark key={i} style={{ animationDelay: `${Math.min(i, 10) * 70}ms` }} className={`rounded-[3px] text-transparent transition-colors duration-500 motion-safe:animate-mark-in ${active ? "bg-ai-200" : "bg-ai-100"}`}>
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
      className={`panel flex min-h-[60dvh] flex-col md:min-h-[420px] transition-[box-shadow] duration-300 xl:h-full xl:min-h-0 ${
        recording ? "shadow-2 ring-1 ring-danger-700/35" : "focus-within:shadow-2 focus-within:ring-1 focus-within:ring-accent-500/30"
      } ${hasDraft && !recording ? "shadow-none ring-1 ring-line" : ""}`}
    >
      <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
        <div>
          <h2 id="notes-h" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            Doctor notes
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {value.length > MAX_NOTES * 0.8 ? (
            <span className={`num whitespace-nowrap text-[11px] ${over ? "font-medium text-danger-700" : "text-ink-3"}`} aria-live="polite">
              {value.length.toLocaleString()} / {MAX_NOTES.toLocaleString()}
            </span>
          ) : null}
          {voice ? (
            // One toggle: Record becomes Stop, with the live dot and elapsed time, while the mic is open.
            <Button
              variant={recording ? "danger" : "secondary"}
              size="sm"
              onClick={voice.onToggle}
              loading={voice.status === "connecting"}
              aria-pressed={recording}
              aria-describedby="voice-hint"
            >
              {recording ? (
                <>
                  {voice.analyser ? (
                    <LevelMeter analyser={voice.analyser} />
                  ) : (
                    <span className="relative flex size-2" aria-hidden="true">
                      <span className="relative size-2 rounded-full bg-danger-700" />
                    </span>
                  )}
                  Stop
                  {voice.startedAt ? <Elapsed since={voice.startedAt} /> : null}
                  <SquareIcon className="size-3 fill-current" />
                </>
              ) : (
                <>
                  {voice.status === "connecting" ? null : <MicIcon />}
                  {voice.status === "connecting" ? "Connecting…" : "Record"}
                </>
              )}
            </Button>
          ) : null}
        </div>
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
      {/* Dictation lands in the textarea itself; this strip only reports the microphone. */}
      {recording ? (
        <p id="voice-hint" className={`border-t border-dashed border-line px-6 py-2 text-[12px] ${voice?.silent ? "text-danger-700" : "text-ink-3"}`} aria-live="polite">
          {voice?.silent
            ? `No sound is reaching the microphone${voice.device ? ` (${voice.device})` : ""}. Check that it is not muted, or pick another input in the browser's site settings.`
            : `Listening${voice?.device ? ` on ${voice.device}` : ""}…`}
        </p>
      ) : voice?.error ? (
        <p id="voice-hint" role="alert" className="border-t border-line px-6 py-2 text-[12px] text-danger-700">
          {voice.error}
        </p>
      ) : voice ? (
        <span id="voice-hint" className="sr-only">
          Dictate into the notes. Words appear as you speak.
        </span>
      ) : null}

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
