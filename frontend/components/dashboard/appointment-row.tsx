"use client";

import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "motion/react";
import { SPRING } from "@/components/shared/reveal";
import { SafeLink } from "@/components/shared/safe-link";
import { StatusBadge } from "@/components/shared/status-badge";
import type { AppointmentDto } from "@/lib/api/types";

export function AppointmentRow({
  appointment: a,
  index,
  current,
}: {
  appointment: AppointmentDto & { time: string };
  index: number;
  current: boolean;
}) {
  const done = a.status === "COMPLETED";
  const inRoom = a.status === "IN_CONSULTATION";
  const profileHref = done ? `/patients/${a.patientId}` : `/patients/${a.patientId}?appointmentId=${encodeURIComponent(a.id)}`;
  const consultHref = `/patients/${a.patientId}/consultation?appointmentId=${encodeURIComponent(a.id)}`;
  const [clock, meridiem] = a.time.split(" ");
  const reduce = useReducedMotion();

  return (
    // Stretched-link row: the name is the real link and covers the row; the action button sits above it.
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: Math.min(index, 12) * 0.04 }}
      className={`group relative grid grid-cols-[4.25rem_1fr_auto] items-center gap-x-3 border-b border-line px-4 py-4 transition-colors duration-150 last:border-0 hover:bg-surface-2/70 active:bg-surface-2 has-[a:focus-visible]:bg-surface-2/70 has-[a:focus-visible]:shadow-[inset_3px_0_0_var(--color-accent-500)] sm:grid-cols-[5.5rem_1.5rem_1fr_8rem_9rem] sm:gap-x-6 sm:px-5 ${
        current ? "bg-accent-50/40" : ""
      }`}
    >
      <div className={`num font-mono text-[13px] leading-tight ${done ? "text-ink-4" : "text-ink"}`}>
        <span className="font-medium">{clock}</span>
        <span className="ml-1 text-[11px] text-ink-3">{meridiem}</span>
        {current ? (
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.08em] text-accent-700 uppercase">{inRoom ? "In room" : "Up next"}</span>
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
          className={`block truncate text-[15px] font-medium focus-visible:outline-none after:absolute after:inset-0 after:content-[''] ${done ? "text-ink-2" : "text-ink"}`}
        >
          {a.patient.name}
        </SafeLink>
        <p className={`mt-0.5 truncate text-[13px] ${done ? "text-ink-4" : "text-ink-3"}`}>{a.reason}</p>
      </div>

      <div className="hidden sm:block">
        <StatusBadge status={a.status} />
      </div>

      <div className="relative z-10 flex justify-end">
        {done ? (
          <Button variant="ghost" size="sm" className="hidden text-ink-3 group-hover:text-ink sm:inline-flex" render={<SafeLink href={profileHref} />}>
            View record
            <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        ) : (
          <Button variant={current ? "primary" : "secondary"} size="sm" className="hidden sm:inline-flex" render={<SafeLink href={consultHref} />}>
            {inRoom ? "Continue" : "Start consultation"}
            <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        )}
        {/* Phones: one icon action; the row itself opens the patient. */}
        <Button
          variant={current ? "primary" : "ghost"}
          size="icon-sm"
          className="sm:hidden"
          aria-label={done ? `View ${a.patient.name}'s record` : `${inRoom ? "Continue" : "Start"} consultation with ${a.patient.name}`}
          render={<SafeLink href={done ? profileHref : consultHref} />}
        >
          <ArrowRightIcon />
        </Button>
      </div>
    </motion.li>
  );
}
