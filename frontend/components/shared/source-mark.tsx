/** Row-level marker for a model-drafted item: the row's tint carries the meaning visually, this carries it for screen readers. */
export function AiDot() {
  return (
    <span className="size-1.5 shrink-0 rounded-full bg-ai-500">
      <span className="sr-only">AI draft: </span>
    </span>
  );
}

/** The small monogram that marks anything the model produced. */
export function AiMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-[18px] shrink-0 items-center rounded-[4px] bg-ai-100 px-1.5 font-mono text-[11px] font-semibold leading-none tracking-wide text-ai-700 ${className}`}
    >
      AI
    </span>
  );
}
