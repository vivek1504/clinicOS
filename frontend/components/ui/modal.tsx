"use client";

import { useEffect, useId, useRef } from "react";
import { XIcon } from "lucide-react";
import { Button } from "./button";

/** Native <dialog> for a form: focus trap, Esc, inert background and the same enter/leave motion as ConfirmDialog. */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      delete el.dataset.closing;
      if (!el.open) el.showModal();
      return;
    }
    if (!el.open) return;
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
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[600px] overflow-y-auto rounded-xl bg-surface p-0 text-ink shadow-3 outline-none"
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <h2 id={titleId} className="display text-[26px] leading-none text-ink">
            {title}
          </h2>
          {description ? <p className="mt-1.5 text-[13px] text-ink-3">{description}</p> : null}
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose} className="-mr-2 -mt-1 text-ink-3">
          <XIcon />
        </Button>
      </div>
      {/* Unmount while closed so a reopened form starts clean. */}
      <div className="px-6 pt-5 pb-6">{open ? children : null}</div>
    </dialog>
  );
}
