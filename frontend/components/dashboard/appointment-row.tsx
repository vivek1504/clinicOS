"use client";

import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "motion/react";
import { SPRING } from "@/components/shared/reveal";
import { SafeLink } from "@/components/shared/safe-link";
import { STATUS_LABEL, StatusBadge } from "@/components/shared/status-badge";
import type { AppointmentDto } from "@/lib/api/types";

export function AppointmentRow({
  appointment: a,
  index,
  current,
  blockedBy,
}: {
  appointment: AppointmentDto & { time: string };
  /** Stagger position on first paint; -1 once the list is settled, so filters do not replay the entrance. */
  index: number;
  current: boolean;
  /** Who must finish before this row can start: the patient in the room, or the earliest one still waiting ahead. */
  blockedBy: string | null;
}) {
  const done = a.status === "COMPLETED";
  const inRoom = a.status === "IN_CONSULTATION";
  const noShow = a.status === "NO_SHOW";
  const booked = a.status === "BOOKED";
  const cancelled = a.status === "CANCELLED";
  const muted = done || noShow || cancelled;
  const profileHref = done ? `/patients/${a.patientId}` : `/patients/${a.patientId}?appointmentId=${encodeURIComponent(a.id)}`;
  const consultHref = `/patients/${a.patientId}/consultation?appointmentId=${encodeURIComponent(a.id)}`;
  const [clock, meridiem] = a.time.split(" ");
  const reduce = useReducedMotion();

  return (
    // Stretched-link row: the name is the real link and covers the row; the action button sits above it.
    <motion.li
      initial={reduce || index < 0 ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: Math.min(index, 12) * 0.04 }}
      className={`group relative grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line px-4 py-3.5 transition-colors duration-150 last:border-0 hover:bg-surface-2/70 active:bg-surface-2 has-[a:focus-visible]:bg-surface-2/70 has-[a:focus-visible]:shadow-[inset_3px_0_0_var(--color-accent-500)] sm:grid-cols-[5.5rem_1.5rem_minmax(0,1fr)_auto] sm:gap-x-6 sm:px-5 ${
        current ? "bg-accent-50/40 shadow-[inset_3px_0_0_var(--color-accent-500)]" : ""
      }`}
    >
      <div className={`num font-mono text-[13px] leading-tight ${muted ? "text-ink-3" : "text-ink"}`}>
        <span className="font-medium">{clock}</span>
        <span className="ml-1 text-[11px] text-ink-3">{meridiem}</span>
        {current ? (
          <span className="mt-1 block text-[11px] font-semibold tracking-[0.08em] text-accent-700 uppercase">{inRoom ? "In room" : "Up next"}</span>
        ) : null}
      </div>

      <span aria-hidden="true" className="relative hidden h-full items-center justify-center sm:flex">
        <span
          className={`relative z-10 block size-2.5 rounded-full border-2 transition-transform duration-200 group-hover:scale-110 ${
            done
              ? "border-line-strong bg-surface"
              : current
                ? "border-accent-600 bg-accent-600 animate-pulse-dot"
                : "border-ink-4 bg-surface"
          }`}
        />
      </span>

      <div className="min-w-0">
        <SafeLink
          href={profileHref}
          className={`block truncate text-[15px] focus-visible:outline-none after:absolute after:inset-0 after:content-[''] ${current ? "font-semibold" : "font-medium"} ${muted ? "text-ink-2" : "text-ink"}`}
        >
          {a.patient.name}
        </SafeLink>
        <p className={`mt-0.5 truncate text-[13px] ${muted ? "text-ink-3" : "text-ink-3"}`}>{a.reason}</p>
      </div>

      <div className="relative z-10 flex items-center justify-end gap-2">
        {/* Waiting is the default and says nothing; done and booked are routine and read as text; the rest earn a pill. */}
        {a.status === "WAITING" ? null : a.status === "COMPLETED" || a.status === "BOOKED" ? (
          <span className="hidden text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase sm:inline">{STATUS_LABEL[a.status]}</span>
        ) : (
          <span className="hidden sm:inline-flex">
            <StatusBadge status={a.status} />
          </span>
        )}
        {noShow || booked ? (
          <span className="hidden text-[12px] text-ink-3 sm:inline">{noShow ? "Front desk marks arrival" : "Not checked in yet"}</span>
        ) : cancelled ? null : done ? (
          <Button variant="ghost" size="sm" className="hidden text-ink-3 group-hover:text-ink sm:inline-flex" render={<SafeLink href={profileHref} />}>
            View record
            <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        ) : blockedBy ? (
          <Button variant="secondary" size="sm" className="hidden sm:inline-flex" disabled title={`${blockedBy} first`}>
            Start consultation
          </Button>
        ) : (
          <Button variant={current ? "primary" : "secondary"} size="sm" className="hidden sm:inline-flex" render={<SafeLink href={consultHref} />}>
            {inRoom ? "Continue" : "Start consultation"}
            <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        )}
        {/* Phones: one short labeled action; the row itself opens the patient. */}
        {cancelled ? null : blockedBy || noShow || booked ? (
          <Button variant="ghost" size="sm" className="sm:hidden" disabled title={blockedBy ? `${blockedBy} first` : undefined}>
            {noShow ? "Absent" : booked ? "Booked" : "Waiting"}
          </Button>
        ) : (
          <Button variant={current ? "primary" : "ghost"} size="sm" className="sm:hidden" render={<SafeLink href={done ? profileHref : consultHref} />}>
            {done ? "Record" : inRoom ? "Continue" : "Start"}
          </Button>
        )}
      </div>
    </motion.li>
  );
}
