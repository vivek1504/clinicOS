"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

export function CopyId({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          // clipboard unavailable; nothing to do
        }
      }}
      aria-label={done ? "Copied" : `Copy patient ID ${value}`}
      className="inline-flex items-center gap-1.5 rounded-sm font-mono text-[11px] tracking-wide text-ink-3 transition-colors hover:text-ink"
    >
      {value}
      {done ? <CheckIcon className="size-3 text-accent-700" aria-hidden="true" /> : <CopyIcon className="size-3" aria-hidden="true" />}
    </button>
  );
}
