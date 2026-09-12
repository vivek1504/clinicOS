"use client";

import { useEffect, useRef } from "react";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { DRAFT_LIST_FIELDS, countUnreviewedAi, type DraftListField, type NoteDraft } from "./draft-model";
import { ListField } from "./list-field";

export function StructuredDraft({
  draft,
  aiGenerated,
  missingInformation,
  onChiefComplaint,
  onItemAdd,
  onItemEdit,
  onItemRemove,
  onRestorePrevious,
  onItemFocus,
  draftVersion = 0,
  firstFieldRef,
}: {
  draft: NoteDraft;
  aiGenerated: boolean;
  missingInformation: string[];
  onChiefComplaint: (value: string) => void;
  onItemAdd: (field: DraftListField, value: string) => void;
  onItemEdit: (field: DraftListField, id: string, value: string) => void;
  onItemRemove: (field: DraftListField, id: string) => void;
  /** Present after a regenerate: swaps the draft that was replaced back in. */
  onRestorePrevious?: () => void;
  onItemFocus?: (value: string | null) => void;
  draftVersion?: number;
  firstFieldRef: React.RefObject<HTMLInputElement | null>;
}) {
  const unreviewed = countUnreviewedAi(draft);
  const cc = draft.chiefComplaint;
  const bodyRef = useRef<HTMLDivElement>(null);

  /** Walks the unreviewed AI fields in document order from wherever the caret is; editing one flips it to the doctor and
   *  drops it from the walk. Past the last one it stops rather than wrapping: a review has an end. */
  const reviewNext = () => {
    const body = bodyRef.current;
    const active = document.activeElement;
    const inside = active instanceof HTMLElement && body?.contains(active);
    const el = Array.from(body?.querySelectorAll<HTMLInputElement>(".ai-item input") ?? []).find(
      (i) => !inside || active.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length); // caret at the end: typing appends, it never wipes the item
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  // ⌘. / Ctrl+. walks the unreviewed items without leaving the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        reviewNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex flex-1 flex-col">
      {aiGenerated || onRestorePrevious ? (
        <Reveal className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-6 py-2.5 backdrop-blur-md">
          {aiGenerated ? (
            unreviewed > 0 ? (
              <button
                type="button"
                onClick={reviewNext}
                aria-live="polite"
                title="⌘. next · ↵ accept as written · type to change"
                className="num inline-flex h-7 items-center gap-1.5 rounded-full bg-ai-100 px-3 text-[12px] font-medium text-ai-700 transition-colors duration-300 hover:bg-ai-200"
              >
                Review {unreviewed} {unreviewed === 1 ? "item" : "items"}
                <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                <kbd className="ml-1 hidden rounded-[3px] bg-ai-700/10 px-1 font-sans text-[10px] font-medium text-ai-700 sm:inline">⌘.</kbd>
              </button>
            ) : (
              <span aria-live="polite" className="num inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-50 px-3 text-[12px] font-medium text-accent-700">
                <CheckIcon className="size-3" strokeWidth={2.5} aria-hidden="true" />
                Ready to record
              </span>
            )
          ) : null}
          {draftVersion > 1 ? <span className="num ml-auto text-[12px] text-ink-3">Draft {draftVersion}</span> : null}
          {onRestorePrevious ? (
            <button type="button" onClick={onRestorePrevious} className={`text-[12px] font-medium text-ink-3 underline-offset-2 transition-colors hover:text-ink hover:underline ${draftVersion > 1 ? "" : "ml-auto"}`}>
              Restore previous draft
            </button>
          ) : null}
        </Reveal>
      ) : null}

      <div ref={bodyRef} className="flex flex-col gap-7 px-6 py-6">
        <Reveal index={1}>
          <label htmlFor="chief-complaint" className="eyebrow block pb-2.5 text-ink-2">
            Chief complaint
          </label>
          <div
            className={`flex items-center gap-2 rounded-r-md border-l-2 pl-3 transition-[background-color,border-color,box-shadow] duration-200 ${
              cc.source === "ai" ? "ai-item" : "doctor-item"
            }`}
            onMouseEnter={() => onItemFocus?.(cc.value)}
            onMouseLeave={() => onItemFocus?.(null)}
            onFocus={() => onItemFocus?.(cc.value)}
            onBlur={() => onItemFocus?.(null)}
          >
            {cc.source === "ai" ? <span className="sr-only">AI draft: </span> : null}
            <input
              ref={firstFieldRef}
              id="chief-complaint"
              value={cc.value}
              onChange={(e) => onChiefComplaint(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && cc.source === "ai") {
                  e.preventDefault();
                  onChiefComplaint(cc.value);
                  reviewNext();
                }
              }}
              placeholder="Primary concern, in a few words"
              className="h-11 min-w-0 flex-1 bg-transparent text-[20px] font-semibold tracking-[-0.01em] text-ink outline-none placeholder:text-[16px] placeholder:font-normal placeholder:text-ink-4"
            />
            {cc.edited ? <span className="sr-only">Doctor edited</span> : null}
          </div>
        </Reveal>

        {DRAFT_LIST_FIELDS.map(({ key, label, singular }, i) => (
          <Reveal key={key} index={i + 2}>
            <ListField
              id={key}
              label={label}
              singular={singular}
              items={draft[key]}
              onAdd={(v) => onItemAdd(key, v)}
              onEdit={(id, v) => onItemEdit(key, id, v)}
              onRemove={(id) => onItemRemove(key, id)}
              onItemFocus={onItemFocus}
              onReviewNext={reviewNext}
            />
          </Reveal>
        ))}

        {aiGenerated && missingInformation.length > 0 ? (
          <Reveal index={6}>
            <section aria-labelledby="missing-h" className="rounded-md border border-dashed border-ai-200 bg-ai-50/50 px-4 py-3.5">
            <h3 id="missing-h" className="eyebrow text-ai-700">
              Needs your input · {missingInformation.length} not in your notes
            </h3>
            <ul className="mt-2.5 space-y-1.5">
              {missingInformation.map((m, i) => (
                <li key={`${m}-${i}`} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
                  <span aria-hidden="true" className="mt-[8px] size-1.5 shrink-0 rounded-full border border-ai-500" />
                  <button
                    type="button"
                    onClick={() => document.getElementById(`${fieldFor(m)}-add`)?.focus()}
                    className="text-left underline-offset-2 hover:text-ink hover:underline"
                    title="Add it above if known"
                  >
                    {m}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[12px] text-ink-3">Click one to add it if known. Nothing here goes into the note by itself.</p>
            </section>
          </Reveal>
        ) : null}
      </div>

    </div>
  );
}

// ponytail: keyword guess at which section a missing detail belongs to; the model could name the field if this misfires often.
function fieldFor(missing: string): DraftListField {
  const m = missing.toLowerCase();
  if (/medic|drug|prescri|dose/.test(m)) return "medicationsMentioned";
  if (/histor|previous|past|family|social|allerg/.test(m)) return "relevantHistory";
  if (/plan|follow|treat|investig|test|refer/.test(m)) return "doctorPlan";
  return "symptoms";
}
