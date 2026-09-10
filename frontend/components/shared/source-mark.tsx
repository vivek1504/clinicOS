import { CheckIcon } from "lucide-react";

/** The small monogram that marks anything the model produced. */
export function AiMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-[18px] shrink-0 items-center rounded-[4px] bg-ai-100 px-1.5 font-mono text-[10px] font-semibold leading-none tracking-wide text-ai-700 ${className}`}
    >
      AI
    </span>
  );
}

/** Metadata tag under editable fields: AI draft vs doctor-confirmed. Never a diff colour. */
export function SourceTag({ source }: { source: "ai" | "doctor" }) {
  if (source === "ai") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ai-700">
        <AiMark />
        AI draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-700">
      <CheckIcon className="size-3" strokeWidth={2.5} aria-hidden="true" />
      Edited by doctor
    </span>
  );
}
