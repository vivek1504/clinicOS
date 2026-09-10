"use client";

import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import type { ConsultationDto, PatientDto } from "@/lib/api/types";
import { formatDate, formatGender } from "@/lib/format";

/** Compact patient context. A vertical rail on wide screens, a strip on tablets, collapsible on phones. */
export function ContextRail({ patient, history, className = "" }: { patient: PatientDto; history: ConsultationDto[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const last = history.length ? [...history].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] : null;

  return (
    <aside aria-labelledby="ctx-h" className={`panel xl:self-start ${className}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 id="ctx-h" className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            {patient.name}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {patient.age} · {formatGender(patient.gender)}
          </p>
        </div>
        {/* Phones only: the context collapses. From md up it is always visible, so no toggle is rendered. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="ctx-body"
          aria-label={open ? "Hide patient context" : "Show patient context"}
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 flex size-8 items-center justify-center rounded-md text-ink-4 hover:bg-surface-2 hover:text-ink md:hidden"
        >
          <ChevronDownIcon className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>

      <dl
        id="ctx-body"
        className={`${open ? "grid" : "hidden"} grid-cols-2 gap-px border-t border-line bg-line md:grid md:grid-cols-4 xl:grid-cols-1`}
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
    </aside>
  );
}

function Item({ label, tone, children }: { label: string; tone?: "danger" | "quiet"; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-5 py-3.5">
      <dt className="eyebrow">{label}</dt>
      <dd className={`mt-1 text-[14px] leading-snug ${tone === "danger" ? "font-medium text-danger-700" : tone === "quiet" ? "text-ink-4" : "font-medium text-ink"}`}>
        {children}
      </dd>
    </div>
  );
}
