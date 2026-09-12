"use client";

import { useEffect, useRef } from "react";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native <dialog>: focus trap, Esc, inert background and top-layer stacking come for free. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      delete el.dataset.closing;
      if (!el.open) el.showModal();
      return;
    }
    if (!el.open) return;
    // Mirror the entrance, then close. Reduced motion collapses the animation to ~0ms, so this still closes promptly.
    el.dataset.closing = "";
    const done = () => {
      delete el.dataset.closing;
      if (el.open) el.close();
    };
    el.addEventListener("animationend", done, { once: true });
    const fallback = setTimeout(done, 240);
    return () => {
      clearTimeout(fallback);
      el.removeEventListener("animationend", done);
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-[420px] rounded-xl bg-surface p-0 text-ink shadow-3 outline-none"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="text-[17px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-2">{body}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
