"use client";

import { CheckIcon } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { AiMark } from "@/components/shared/source-mark";
import { DRAFT_LIST_FIELDS, countUnreviewedAi, type AiMeta, type DraftListField, type NoteDraft } from "./draft-model";
import { ListField } from "./list-field";

export function StructuredDraft({
  draft,
  aiGenerated,
  missingInformation,
  aiMeta,
  onChiefComplaint,
  onItemAdd,
  onItemEdit,
  onItemRemove,
  firstFieldRef,
}: {
  draft: NoteDraft;
  aiGenerated: boolean;
  missingInformation: string[];
  aiMeta: AiMeta | null;
  onChiefComplaint: (value: string) => void;
  onItemAdd: (field: DraftListField, value: string) => void;
  onItemEdit: (field: DraftListField, id: string, value: string) => void;
  onItemRemove: (field: DraftListField, id: string) => void;
  firstFieldRef: React.RefObject<HTMLInputElement | null>;
}) {
  const unreviewed = countUnreviewedAi(draft);
  const cc = draft.chiefComplaint;

  return (
    <div className="flex flex-1 flex-col">
      <Reveal className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface/90 px-6 py-4 backdrop-blur-md">
        {aiGenerated ? (
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-ai-700 uppercase">
              <AiMark />
              AI-generated draft
            </p>
            <p className="mt-1 text-[13px] text-ink-3">Review and edit before saving.</p>
          </div>
        ) : (
          <div>
            <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-2 uppercase">Doctor note</p>
            <p className="mt-1 text-[13px] text-ink-3">Entered directly. Nothing here was generated.</p>
          </div>
        )}
        {aiGenerated ? (
          <span
            aria-live="polite"
            className={`num inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors duration-300 ${
              unreviewed > 0 ? "bg-ai-100 text-ai-700" : "bg-accent-50 text-accent-700"
            }`}
          >
            {unreviewed > 0 ? (
              `${unreviewed} AI ${unreviewed === 1 ? "item" : "items"} to review`
            ) : (
              <>
                <CheckIcon className="size-3" strokeWidth={2.5} aria-hidden="true" />
                All AI items reviewed
              </>
            )}
          </span>
        ) : null}
      </Reveal>

      <div className="flex flex-col gap-7 px-6 py-6">
        <Reveal index={1}>
          <label htmlFor="chief-complaint" className="eyebrow block pb-2.5 text-ink-2">
            Chief complaint
          </label>
          <div
            className={`flex items-center gap-2 rounded-md border pl-3 transition-[background-color,border-color,box-shadow] duration-200 ${
              cc.source === "ai" ? "ai-item" : "doctor-item"
            }`}
          >
            {cc.source === "ai" ? <AiMark /> : cc.source === "doctor" ? <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent-500" /> : null}
            <input
              ref={firstFieldRef}
              id="chief-complaint"
              value={cc.value}
              onChange={(e) => onChiefComplaint(e.target.value)}
              placeholder="Primary concern, in a few words"
              className="h-10 min-w-0 flex-1 bg-transparent text-[16px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-4"
            />
            {cc.edited ? <span className="hidden shrink-0 pr-3 text-[11px] font-medium text-accent-700 sm:inline">Edited by doctor</span> : null}
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
            />
          </Reveal>
        ))}

        {aiGenerated && missingInformation.length > 0 ? (
          <Reveal index={6}>
            <section aria-labelledby="missing-h" className="rounded-md border border-dashed border-ai-200 bg-ai-50/50 px-4 py-3.5">
            <h3 id="missing-h" className="eyebrow inline-flex items-center gap-2 text-ai-700">
              <AiMark />
              Missing information
            </h3>
            <ul className="mt-2.5 space-y-1.5">
              {missingInformation.map((m, i) => (
                <li key={`${m}-${i}`} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
                  <span aria-hidden="true" className="mt-[8px] size-1.5 shrink-0 rounded-full border border-ai-500" />
                  {m}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11px] text-ink-4">Not found in your notes. Add it above if known; nothing here is written into the note.</p>
            </section>
          </Reveal>
        ) : null}
      </div>

      {aiMeta ? (
        <p className="num mt-auto border-t border-line px-6 py-3 text-[11px] text-ink-4">
          Structured by {aiMeta.model} in {(aiMeta.latencyMs / 1000).toFixed(1)}s
        </p>
      ) : null}
    </div>
  );
}
