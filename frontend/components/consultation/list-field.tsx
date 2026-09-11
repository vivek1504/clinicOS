"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PlusIcon, XIcon } from "lucide-react";
import { SPRING_QUICK } from "@/components/shared/reveal";
import { AiDot } from "@/components/shared/source-mark";
import type { Item } from "./draft-model";

export function ListField({
  id,
  label,
  singular,
  items,
  onAdd,
  onEdit,
  onRemove,
}: {
  id: string;
  label: string;
  singular: string;
  items: Item[];
  onAdd: (value: string) => void;
  onEdit: (itemId: string, value: string) => void;
  onRemove: (itemId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const addRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();
  const unreviewed = items.filter((i) => i.source === "ai").length;

  const commitAdd = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
    addRef.current?.focus();
  };

  return (
    <fieldset className="min-w-0">
      <legend className="flex w-full items-baseline justify-between gap-3 pb-2.5">
        <span className="eyebrow text-ink-2">{label}</span>
        {unreviewed > 0 ? (
          <span className="num text-[11px] font-medium text-ai-700">
            {unreviewed} to review
          </span>
        ) : items.length > 0 ? (
          <span className="num text-[11px] text-ink-3">{items.length}</span>
        ) : null}
      </legend>

      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {items.map((item, idx) => (
            <motion.li
              key={item.id}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: 8, transition: { duration: 0.16 } }}
              transition={SPRING_QUICK}
              className={`group/item flex items-center gap-2 rounded-md border pl-3 transition-[background-color,border-color,box-shadow] duration-200 ${
                item.source === "ai" ? "ai-item" : "doctor-item"
              }`}
            >
              {item.source === "ai" ? (
                <AiDot />
              ) : (
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent-500" />
              )}
              <input
                aria-label={`${label} item ${idx + 1}`}
                value={item.value}
                onChange={(e) => onEdit(item.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && item.value === "") {
                    e.preventDefault();
                    onRemove(item.id);
                  }
                }}
                className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
              />
              {item.edited ? (
                <span className="hidden shrink-0 text-[11px] font-medium text-accent-700 sm:inline">Doctor edited</span>
              ) : null}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${singular}: ${item.value}`}
                className="flex size-9 shrink-0 items-center justify-center rounded-r-md text-ink-3 opacity-60 transition-[opacity,color,background-color] duration-150 group-hover/item:opacity-100 hover:bg-ink/5 hover:text-ink focus-visible:opacity-100"
              >
                <XIcon className="size-3.5" aria-hidden="true" />
              </button>
            </motion.li>
          ))}
        </AnimatePresence>

        <li className="flex items-center gap-2 rounded-md border border-dashed border-line-strong pl-3 transition-colors duration-150 focus-within:border-accent-500 focus-within:bg-surface hover:border-ink-4">
          <PlusIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
          <input
            ref={addRef}
            id={`${id}-add`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitAdd();
              } else if (e.key === "Backspace" && draft === "" && items.length > 0) {
                e.preventDefault();
                onRemove(items[items.length - 1].id);
              }
            }}
            onBlur={commitAdd}
            placeholder={`Add ${singular}`}
            aria-label={`Add ${singular}`}
            className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-4"
          />
        </li>
      </ul>
    </fieldset>
  );
}
