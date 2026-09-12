"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SPRING_QUICK } from "@/components/shared/reveal";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon, CalendarRemove01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmCancel, setConfirmCancel] = useState<Row | null>(null);
  const manyDoctors = new Set(rows.map((r) => r.doctorId)).size > 1;
  const toCheckIn = rows.filter((r) => r.status === "BOOKED").length;

  const goTo = (d: string) => router.replace(`/front-desk?date=${d}`);
  const [dateOpen, setDateOpen] = useState(false);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

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
            <Button variant="ghost" size="icon-sm" className="rounded-r-none" aria-label="Previous day" disabled={isToday} onClick={() => goTo(shiftDate(date, -1))}>
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            {/* The desk only looks forward: yesterday's list is the doctor's business, so past days cannot be picked. */}
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger aria-label="Schedule date" render={<Button variant="ghost" size="sm" className="num h-8 rounded-none border-x border-line px-3 text-[13px] font-medium" />}>
                <HugeiconsIcon icon={Calendar03Icon} className="size-3.5 text-ink-3" />
                {formatShortDate(new Date(`${date}T12:00:00`))}
              </PopoverTrigger>
              <PopoverContent align="center" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={new Date(`${date}T12:00:00`)}
                  defaultMonth={new Date(`${date}T12:00:00`)}
                  disabled={{ before: todayStart }}
                  onSelect={(d) => {
                    if (!d) return;
                    goTo(new Intl.DateTimeFormat("en-CA").format(d));
                    setDateOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon-sm" className="rounded-l-none" aria-label="Next day" onClick={() => goTo(shiftDate(date, 1))}>
              <HugeiconsIcon icon={ArrowRight01Icon} />
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
            icon={<HugeiconsIcon icon={CalendarRemove01Icon} className="size-5" aria-hidden="true" />}
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
            {/* Rows keep their place on refresh: a new booking fades in, a moved one slides to its slot, a rescheduled one fades out. */}
            <AnimatePresence initial={false}>
            {rows.map((a) => {
              const [clock, meridiem] = a.time.split(" ");
              const quiet = a.status === "COMPLETED" || a.status === "NO_SHOW" || a.status === "CANCELLED";
              const isBusy = busy === a.id;
              const canMove = a.status === "BOOKED" || a.status === "WAITING" || a.status === "NO_SHOW";
              return (
                <motion.li key={a.id} layout={!reduce} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }} transition={SPRING_QUICK} className={`grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-line px-4 py-4 first:rounded-t-lg last:rounded-b-lg last:border-0 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto] sm:gap-x-6 sm:px-5 ${a.status === "IN_CONSULTATION" ? "bg-accent-50/40" : ""}`}>
                  <div className={`num font-mono text-[14px] leading-tight ${quiet ? "text-ink-3" : "text-ink"}`}>
                    <span className="font-medium">{clock}</span>
                    <span className="ml-1 text-[12px] text-ink-3">{meridiem}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <SafeLink href={`/patients/${a.patientId}`} className={`truncate text-[16px] font-medium hover:underline ${quiet ? "text-ink-2" : "text-ink"}`}>
                        {a.patient.name}
                      </SafeLink>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[14px] text-ink-3">
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
                    {/* The whole cell crossfades when the status changes, so "Check in" does not blink out under the cursor. */}
                    <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={a.status} initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0, scale: 0.96 }} transition={{ duration: 0.12 }} className="flex items-center gap-1.5">
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
                          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" aria-hidden="true" />
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
                    </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.li>
              );
            })}
            </AnimatePresence>
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
