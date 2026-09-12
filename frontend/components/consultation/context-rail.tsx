"use client";

import { useState } from "react";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import { SafeLink } from "@/components/shared/safe-link";
import type { ConsultationDto, PatientDto } from "@/lib/api/types";
import { formatDate, formatGender } from "@/lib/format";

/** Compact patient context. A vertical rail on wide screens, a strip on tablets, collapsible on phones. */
export function ContextRail({ patient, history, className = "" }: { patient: PatientDto; history: ConsultationDto[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const last = history.length ? [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] : null;

  return (
    <aside aria-labelledby="ctx-h" className={`max-xl:rounded-lg max-xl:bg-surface max-xl:shadow-1 max-md:sticky max-md:top-[64px] max-md:z-10 xl:self-start xl:pr-4 ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 xl:px-0 xl:pt-1">
        <div>
          <h2 id="ctx-h" className="text-[15px] font-semibold tracking-[-0.01em] text-ink xl:text-[14px]">
            {patient.name}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {patient.age} · {formatGender(patient.gender)}
          </p>
          {/* Phones collapse the rail, but an allergy must never be behind a toggle. */}
          {patient.allergies.length && !open ? (
            <p className="mt-1 text-[13px] font-medium text-danger-700 md:hidden">
              {patient.allergies.length === 1 ? "Allergy" : "Allergies"}: {patient.allergies.join(", ")}
            </p>
          ) : null}
        </div>
        {/* Phones only: the context collapses. From md up it is always visible, so no toggle is rendered. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="ctx-body"
          aria-label={open ? "Hide patient context" : "Show patient context"}
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink md:hidden"
        >
          <ChevronDownIcon className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      <dl
        id="ctx-body"
        className={`${open ? "grid" : "hidden"} grid-cols-2 gap-px border-t border-line bg-line md:grid md:grid-cols-4 xl:grid-cols-1 xl:gap-0 xl:divide-y xl:divide-line xl:bg-transparent`}
      >
        <Item label={patient.allergies.length === 1 ? "Allergy" : "Allergies"} tone={patient.allergies.length ? "danger" : "quiet"}>
          {patient.allergies.length ? patient.allergies.join(", ") : "No known allergies"}
        </Item>
        <Item label="Existing conditions" tone={patient.conditions.length ? undefined : "quiet"}>
          {patient.conditions.length ? patient.conditions.join(", ") : "None"}
        </Item>
        <Item label="Previous visits">
          <span className="num">{history.length}</span>
        </Item>
        <Item label="Last consultation" tone={last ? undefined : "quiet"}>
          {last ? (
            <>
              {formatDate(last.createdAt)}
              {last.finalNote.chiefComplaint ? <span className="block truncate text-[12px] font-normal text-ink-3">{last.finalNote.chiefComplaint}</span> : null}
            </>
          ) : (
            "First visit"
          )}
        </Item>
      </dl>

      {/* Guarded link: leaving with unsaved notes still asks first. */}
      <div className="border-t border-line px-5 py-3 xl:px-0">
        <SafeLink href={`/patients/${patient.id}`} className="group inline-flex items-center gap-1 text-[12px] font-medium text-ink-3 transition-colors hover:text-ink">
          View full record
          <ArrowRightIcon className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </SafeLink>
      </div>
    </aside>
  );
}

function Item({ label, tone, children }: { label: string; tone?: "danger" | "quiet"; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-3.5 xl:bg-transparent xl:px-0">
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1 text-[14px] leading-snug xl:text-[13px] ${tone === "danger" ? "font-medium text-danger-700" : tone === "quiet" ? "text-ink-3" : "font-medium text-ink xl:font-normal xl:text-ink-2"}`}>
        {children}
      </dd>
    </div>
  );
}
