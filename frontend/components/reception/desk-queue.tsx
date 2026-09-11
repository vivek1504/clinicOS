"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, CalendarXIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SafeLink } from "@/components/shared/safe-link";
import { StatusBadge } from "@/components/shared/status-badge";
import { patchAppointmentStatus } from "@/lib/api/appointments";
import { ApiError } from "@/lib/api/client";
import type { AppointmentDto, AppointmentStatus } from "@/lib/api/types";
import { formatShortDate, pluralize } from "@/lib/format";

type Row = AppointmentDto & { time: string };

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA").format(d);
}

/** A menu entry that closes its <details> before acting, so the menu never lingers over the refreshed row. */
function MenuItem({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="justify-start"
      disabled={disabled}
      onClick={(e: React.MouseEvent) => {
        (e.currentTarget as HTMLElement).closest("details")?.removeAttribute("open");
        onClick();
      }}
    >
      {children}
    </Button>
  );
}

/** The receptionist's schedule: check in, mark absent, reschedule, cancel. Never starts a consultation. */
export function DeskQueue({ rows, date, isToday }: { rows: Row[]; date: string; isToday: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmCancel, setConfirmCancel] = useState<Row | null>(null);
  const manyDoctors = new Set(rows.map((r) => r.doctorId)).size > 1;
  const toCheckIn = rows.filter((r) => r.status === "BOOKED").length;

  const goTo = (d: string) => router.replace(`/front-desk?date=${d}`);

  const mark = async (row: Row, status: AppointmentStatus) => {
    setBusy(row.id);
    setErrors((e) => ({ ...e, [row.id]: "" }));
    try {
      await patchAppointmentStatus(row.id, status);
      router.refresh();
    } catch (err) {
      setErrors((e) => ({ ...e, [row.id]: err instanceof ApiError ? err.message : "Couldn't update" }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="desk-h" className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-4">
        <div>
          <h2 id="desk-h" className="text-[20px] font-semibold tracking-[-0.015em] text-ink">
            {isToday ? "Today's schedule" : "Schedule"}
          </h2>
          <p className="mt-0.5 text-[13px] text-ink-3">{rows.length === 0 ? "Nothing booked" : toCheckIn ? `${pluralize(toCheckIn, "patient")} still to check in` : "Everyone booked has been checked in"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md bg-surface shadow-1">
            <Button variant="ghost" size="icon-sm" className="rounded-r-none" aria-label="Previous day" onClick={() => goTo(shiftDate(date, -1))}>
              <ChevronLeftIcon />
            </Button>
            <div className="relative">
              <span aria-hidden="true" className="inline-flex h-8 items-center gap-2 border-x border-line px-3 text-[13px] font-medium num text-ink">
                <CalendarIcon className="size-3.5 text-ink-3" />
                {formatShortDate(new Date(`${date}T12:00:00`))}
              </span>
              <input type="date" value={date} onChange={(e) => e.target.value && goTo(e.target.value)} aria-label="Schedule date" className="absolute inset-0 cursor-pointer opacity-0 focus-visible:opacity-100" />
            </div>
            <Button variant="ghost" size="icon-sm" className="rounded-l-none" aria-label="Next day" onClick={() => goTo(shiftDate(date, 1))}>
              <ChevronRightIcon />
            </Button>
          </div>
          {isToday ? null : (
            <Button variant="secondary" size="sm" render={<SafeLink href="/front-desk" />}>
              Today
            </Button>
          )}
          <Button variant="secondary" size="sm" render={<SafeLink href={`/front-desk?date=${date}&walkIn=1`} />}>
            Walk-in
          </Button>
        </div>
      </div>

      <div className="panel">
        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarXIcon className="size-5" aria-hidden="true" />}
            title="No appointments on this day"
            body="Book the first one, or pick another date."
            action={
              <Button size="sm" render={<SafeLink href={`/front-desk?date=${date}&book=1`} />}>
                Book appointment
              </Button>
            }
          />
        ) : (
          <ol aria-label="Appointments">
            {rows.map((a) => {
              const [clock, meridiem] = a.time.split(" ");
              const quiet = a.status === "COMPLETED" || a.status === "NO_SHOW" || a.status === "CANCELLED";
              const isBusy = busy === a.id;
              const canMove = a.status === "BOOKED" || a.status === "WAITING" || a.status === "NO_SHOW";
              return (
                <li key={a.id} className={`grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 first:rounded-t-lg last:rounded-b-lg last:border-0 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:gap-x-6 sm:px-5 ${a.status === "IN_CONSULTATION" ? "bg-accent-50/40" : ""}`}>
                  <div className={`num font-mono text-[13px] leading-tight ${quiet ? "text-ink-3" : "text-ink"}`}>
                    <span className="font-medium">{clock}</span>
                    <span className="ml-1 text-[11px] text-ink-3">{meridiem}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <SafeLink href={`/patients/${a.patientId}`} className={`truncate text-[15px] font-medium hover:underline ${quiet ? "text-ink-2" : "text-ink"}`}>
                        {a.patient.name}
                      </SafeLink>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className={`mt-0.5 truncate text-[13px] ${quiet ? "text-ink-3" : "text-ink-3"}`}>
                      {manyDoctors ? `${a.doctor.name} · ` : ""}
                      {a.reason}
                    </p>
                    {errors[a.id] ? (
                      <p role="alert" className="mt-1 text-[12px] font-medium text-danger-700">
                        {errors[a.id]}
                      </p>
                    ) : null}
                  </div>
                  {/* One action a receptionist does often stays visible; the rare ones sit behind More. */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5 sm:col-span-1">
                    {a.status === "BOOKED" ? (
                      <Button size="sm" loading={isBusy} disabled={isBusy} onClick={() => void mark(a, "WAITING")}>
                        Check in
                      </Button>
                    ) : null}
                    {a.status === "NO_SHOW" ? (
                      <Button size="sm" variant="secondary" loading={isBusy} disabled={isBusy} onClick={() => void mark(a, "WAITING")}>
                        Arrived
                      </Button>
                    ) : null}
                    {a.status === "CANCELLED" ? (
                      <Button size="sm" variant="ghost" className="text-ink-3" loading={isBusy} disabled={isBusy} onClick={() => void mark(a, "BOOKED")}>
                        Restore
                      </Button>
                    ) : null}
                    {canMove ? (
                      <details className="relative">
                        <summary
                          aria-label={`More actions for ${a.patient.name}`}
                          className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-md px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-ink/6 hover:text-ink [&::-webkit-details-marker]:hidden"
                        >
                          More
                          <ChevronDownIcon className="size-3.5" aria-hidden="true" />
                        </summary>
                        <div className="panel absolute right-0 z-20 mt-1 flex w-48 flex-col p-1 shadow-2">
                          {a.status !== "NO_SHOW" ? (
                            <MenuItem disabled={isBusy} onClick={() => void mark(a, "NO_SHOW")}>
                              Mark absent
                            </MenuItem>
                          ) : null}
                          <Button size="sm" variant="ghost" className="justify-start" render={<SafeLink href={`/front-desk?date=${date}&appointmentId=${encodeURIComponent(a.id)}`} />}>
                            Reschedule
                          </Button>
                          <MenuItem disabled={isBusy} onClick={() => setConfirmCancel(a)}>
                            Cancel appointment
                          </MenuItem>
                        </div>
                      </details>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel !== null}
        title="Cancel this appointment?"
        body={confirmCancel ? `${confirmCancel.patient.name} at ${confirmCancel.time} will be taken off the schedule. The slot becomes free again.` : ""}
        confirmLabel="Cancel appointment"
        cancelLabel="Keep it"
        destructive
        onConfirm={() => {
          const row = confirmCancel;
          setConfirmCancel(null);
          if (row) void mark(row, "CANCELLED");
        }}
        onCancel={() => setConfirmCancel(null)}
      />
    </section>
  );
}
