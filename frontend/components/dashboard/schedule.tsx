"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarIcon, CalendarXIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SafeLink } from "@/components/shared/safe-link";
import { STATUS_LABEL } from "@/components/shared/status-badge";
import type { AppointmentDto, AppointmentStatus } from "@/lib/api/types";
import { formatShortDate, pluralize } from "@/lib/format";
import { AppointmentRow } from "./appointment-row";

export type AppointmentRowData = AppointmentDto & { time: string };

const FILTERS: (AppointmentStatus | "ALL")[] = ["ALL", "WAITING", "IN_CONSULTATION", "COMPLETED"];

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA").format(d);
}

export function Schedule({ rows, date, isToday }: { rows: AppointmentRowData[]; date: string; isToday: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<AppointmentStatus | "ALL">("ALL");

  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (status === "ALL" || r.status === status) &&
      (!q || r.patient.name.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q)),
  );
  const filtered = q !== "" || status !== "ALL";
  const remaining = rows.filter((r) => r.status !== "COMPLETED").length;
  // The clinician's next action: the patient in the room, otherwise the earliest waiting one.
  const current = rows.find((r) => r.status === "IN_CONSULTATION") ?? rows.find((r) => r.status === "WAITING") ?? null;
  const goTo = (d: string) => router.replace(d === new Intl.DateTimeFormat("en-CA").format(new Date()) ? "/" : `/?date=${d}`);

  return (
    <section aria-labelledby="schedule-h" className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          <h2 id="schedule-h" className="text-[20px] font-semibold tracking-[-0.015em] text-ink">
            {isToday ? "Today's appointments" : "Appointments"}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {rows.length === 0
              ? "Nothing scheduled"
              : remaining === 0
                ? "All consultations completed"
                : `${pluralize(remaining, "patient")} still to see`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-4" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search patient or reason"
              aria-label="Search appointments"
              className="h-9 w-56 pl-8 sm:w-64"
            />
          </div>

          <div className="flex items-center rounded-md bg-surface shadow-1">
            <Button variant="ghost" size="icon-sm" className="rounded-r-none" aria-label="Previous day" onClick={() => goTo(shiftDate(date, -1))}>
              <ChevronLeftIcon />
            </Button>
            <div className="relative">
              <span aria-hidden="true" className="inline-flex h-8 items-center gap-2 border-x border-line px-3 text-[13px] font-medium num text-ink">
                <CalendarIcon className="size-3.5 text-ink-3" />
                {formatShortDate(new Date(`${date}T12:00:00`))}
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && goTo(e.target.value)}
                aria-label="Appointment date"
                className="absolute inset-0 cursor-pointer opacity-0 focus-visible:opacity-100"
              />
            </div>
            <Button variant="ghost" size="icon-sm" className="rounded-l-none" aria-label="Next day" onClick={() => goTo(shiftDate(date, 1))}>
              <ChevronRightIcon />
            </Button>
          </div>
          {isToday ? null : (
            <Button variant="secondary" size="sm" render={<SafeLink href="/" />}>
              Today
            </Button>
          )}
        </div>
      </div>

      <div className="panel flex flex-col overflow-hidden">
        <div role="group" aria-label="Filter by status" className="flex gap-1 overflow-x-auto border-b border-line px-3 py-2">
          {FILTERS.map((f) => {
            const n = f === "ALL" ? rows.length : rows.filter((r) => r.status === f).length;
            const active = status === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(f)}
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors duration-150 ${
                  active ? "bg-ink text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {f === "ALL" ? "All" : STATUS_LABEL[f]}
                <span className={`num text-xs ${active ? "text-white/60" : "text-ink-4"}`}>{n}</span>
              </button>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarXIcon className="size-5" aria-hidden="true" />}
            title="No appointments on this day"
            body="Nothing is booked. Pick another date, or check back when the front desk adds bookings."
            action={
              isToday ? undefined : (
                <Button variant="secondary" size="sm" render={<SafeLink href="/" />}>
                  Back to today
                </Button>
              )
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<SearchXIcon className="size-5" aria-hidden="true" />}
            title="No appointments match"
            body="Try a different name or reason, or clear the filters."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setStatus("ALL");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <ol className="relative" aria-label="Appointments">
            <span aria-hidden="true" className="absolute top-0 bottom-0 left-[9rem] hidden w-px bg-line sm:block" />
            {visible.map((a, i) => (
              <AppointmentRow key={a.id} appointment={a} index={i} current={current?.id === a.id} />
            ))}
          </ol>
        )}

        {rows.length > 0 ? (
          <p className="mt-auto flex items-center justify-between border-t border-line px-5 py-3 text-xs text-ink-3">
            <span>{filtered ? `Showing ${visible.length} of ${rows.length}` : pluralize(rows.length, "appointment")}</span>
            <span>Click a row to open the patient</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function ScheduleSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <section aria-busy="true" aria-label="Loading appointments" className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-3.5 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>
      <div className="panel overflow-hidden">
        <div className="flex gap-1 border-b border-line px-3 py-2">
          {[12, 20, 28, 24].map((w, i) => (
            <Skeleton key={i} className={`h-8 w-${w}`} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-6 border-b border-line px-5 py-5 last:border-0 sm:grid-cols-[5.5rem_1.5rem_1fr_8rem_9rem]">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="hidden size-2.5 rounded-full sm:block" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-72 max-w-full" />
            </div>
            <Skeleton className="hidden h-6 w-24 rounded-full sm:block" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
