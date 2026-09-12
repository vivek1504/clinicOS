"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";

/** A form in a dialog. Keeps the old `open`/`onClose` API; the shadcn Dialog underneath handles focus, Esc and the backdrop. */
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
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto bg-surface p-6 text-ink sm:max-w-[600px]">
        <DialogHeader className="pr-8">
          <DialogTitle className="display text-[26px] leading-none font-normal text-ink">{title}</DialogTitle>
          {description ? <DialogDescription className="text-[13px] text-ink-3">{description}</DialogDescription> : null}
        </DialogHeader>
        {/* Unmount while closed so a reopened form starts clean. */}
        <div className="pt-5">{open ? children : null}</div>
      </DialogContent>
    </Dialog>
  );
}
