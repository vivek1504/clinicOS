import * as React from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full min-w-0 resize-none rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-4 focus-visible:border-accent-500 focus-visible:ring-3 focus-visible:ring-accent-500/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
