"use client";

import { useState } from "react";
import { ArrowRightIcon, SearchIcon, UsersIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SafeLink } from "@/components/shared/safe-link";
import type { PatientDto } from "@/lib/api/types";
import { formatGender, pluralize } from "@/lib/format";

/** Every patient on the books, for walk-ins and anyone not on today's list. */
export function PatientDirectory({ patients, action }: { patients: PatientDto[]; action?: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = patients.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
      p.conditions.some((c) => c.toLowerCase().includes(q)) ||
      p.allergies.some((a) => a.toLowerCase().includes(q)),
  );

  return (
    <section aria-labelledby="directory-h" className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          <h2 id="directory-h" className="text-[20px] font-semibold tracking-[-0.015em] text-ink">
            Patients
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">{pluralize(patients.length, "patient")} on the books. Open anyone, scheduled or not.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, phone, condition or allergy"
              aria-label="Search patients"
              className="h-9 w-64 pl-8 sm:w-72"
            />
          </div>
          {action}
        </div>
      </div>

      <div className="panel overflow-hidden">
        {visible.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="size-5" aria-hidden="true" />}
            title={patients.length === 0 ? "No patients yet" : "No patients match"}
            body={patients.length === 0 ? "Patients appear here once they are registered." : "Try a different name, phone number, condition or allergy."}
            className="py-12"
          />
        ) : (
          <ul aria-label="Patients">
            {visible.map((p) => {
              const initials = p.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <li
                  key={p.id}
                  className="group relative grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-4 border-b border-line px-5 py-3.5 transition-colors duration-150 last:border-0 hover:bg-surface-2/70 active:bg-surface-2 has-[a:focus-visible]:bg-surface-2/70 has-[a:focus-visible]:shadow-[inset_3px_0_0_var(--color-accent-500)] md:grid-cols-[2.25rem_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]"
                >
                  <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-[12px] font-semibold text-ink-2">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <SafeLink href={`/patients/${p.id}`} className="block truncate text-[15px] font-medium text-ink focus-visible:outline-none after:absolute after:inset-0 after:content-['']">
                      {p.name}
                    </SafeLink>
                    <p className="mt-0.5 truncate text-[12px] text-ink-3">
                      {p.age} · {formatGender(p.gender)} · <span className="num">{p.phone}</span>
                    </p>
                  </div>
                  <div className="hidden min-w-0 md:block">
                    <p className="eyebrow">{p.allergies.length === 1 ? "Allergy" : "Allergies"}</p>
                    <p className={`mt-0.5 truncate text-[13px] ${p.allergies.length ? "font-medium text-danger-700" : "text-ink-3"}`}>
                      {p.allergies.length ? p.allergies.join(", ") : "None known"}
                    </p>
                  </div>
                  <div className="hidden min-w-0 md:block">
                    <p className="eyebrow">Conditions</p>
                    <p className={`mt-0.5 truncate text-[13px] ${p.conditions.length ? "text-ink" : "text-ink-3"}`}>
                      {p.conditions.length ? p.conditions.join(", ") : "None recorded"}
                    </p>
                  </div>
                  <ArrowRightIcon className="size-4 text-ink-3 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export function PatientDirectorySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <section aria-busy="true" aria-label="Loading patients" className="flex flex-col">
      <div className="flex items-end justify-between pb-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="panel overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-[2.25rem_1.2fr_1fr_1fr_1rem] items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
            <Skeleton className="size-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="size-4" />
          </div>
        ))}
      </div>
    </section>
  );
}
