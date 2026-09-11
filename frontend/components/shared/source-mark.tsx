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
