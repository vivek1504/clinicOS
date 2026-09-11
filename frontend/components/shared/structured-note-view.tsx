import type { NoteListField, StructuredNote } from "@/lib/api/types";

export const NOTE_SECTIONS: { key: NoteListField; label: string }[] = [
  { key: "symptoms", label: "Symptoms" },
  { key: "relevantHistory", label: "Relevant history" },
  { key: "medicationsMentioned", label: "Medications mentioned" },
  { key: "doctorPlan", label: "Doctor plan" },
];

function norm(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Read-only renderer. When `highlightDiffFrom` is given, items not present in that note
 * (or a chief complaint that differs) are marked as the doctor's changes.
 */
export function StructuredNoteView({
  note,
  highlightDiffFrom,
  showMissing = true,
  compact = false,
}: {
  note: StructuredNote;
  highlightDiffFrom?: StructuredNote | null;
  showMissing?: boolean;
  compact?: boolean;
}) {
  const changed = (field: NoteListField, item: string) =>
    highlightDiffFrom ? !highlightDiffFrom[field].some((x) => norm(x) === norm(item)) : false;
  const ccChanged = highlightDiffFrom ? norm(highlightDiffFrom.chiefComplaint) !== norm(note.chiefComplaint) : false;
  const mark = "rounded-[3px] bg-accent-100/80 px-1 -mx-1 text-accent-900 decoration-accent-300 underline decoration-dotted underline-offset-4";

  return (
    <dl className={`grid ${compact ? "gap-4" : "gap-5 sm:grid-cols-[9rem_1fr] sm:gap-x-8 sm:gap-y-5"} text-sm`}>
      <dt className="eyebrow sm:pt-0.5">Chief complaint</dt>
      <dd className="-mt-3 text-[15px] font-medium text-ink sm:mt-0">
        {note.chiefComplaint ? <span className={ccChanged ? mark : ""}>{note.chiefComplaint}</span> : <span className="font-normal text-ink-3 italic">Not recorded</span>}
      </dd>
      {NOTE_SECTIONS.map(({ key, label }) => (
        <Section key={key} label={label} compact={compact}>
          {note[key].length === 0 ? (
            <span className="text-ink-3 italic">None recorded</span>
          ) : (
            <ul className="space-y-1.5">
              {note[key].map((item, i) => (
                <li key={`${item}-${i}`} className="flex gap-2.5 leading-relaxed text-ink">
                  <span aria-hidden="true" className="mt-[9px] size-1 shrink-0 rounded-full bg-ink-4" />
                  <span className={changed(key, item) ? mark : ""}>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}
      {showMissing && note.missingInformation.length > 0 ? (
        <Section label="Missing information" compact={compact}>
          <ul className="space-y-1.5">
            {note.missingInformation.map((item, i) => (
              <li key={`${item}-${i}`} className="flex gap-2.5 leading-relaxed text-ink-2">
                <span aria-hidden="true" className="mt-[9px] size-1 shrink-0 rounded-full border border-ink-4" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </dl>
  );
}

function Section({ label, compact, children }: { label: string; compact: boolean; children: React.ReactNode }) {
  return (
    <>
      <dt className="eyebrow sm:pt-0.5">{label}</dt>
      <dd className={compact ? "-mt-3" : "-mt-3 sm:mt-0"}>{children}</dd>
    </>
  );
}
