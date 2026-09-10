import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ink-4 focus-visible:border-accent-500 focus-visible:ring-3 focus-visible:ring-accent-500/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger-700 aria-invalid:ring-3 aria-invalid:ring-danger-700/15",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
export { Textarea } from "./textarea";
