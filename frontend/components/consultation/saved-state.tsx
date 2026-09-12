"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EASE, SPRING } from "@/components/shared/reveal";
import { SafeLink } from "@/components/shared/safe-link";
import { StructuredNoteView } from "@/components/shared/structured-note-view";
import { getAppointments } from "@/lib/api/appointments";
import type { AppointmentDto, StructuredNote } from "@/lib/api/types";
import { formatTime } from "@/lib/format";

/** The handoff between patients: what was recorded, and who is waiting next. */
export function SavedState({
  patientName,
  patientId,
  linkedToAppointment,
  note,
}: {
  patientName: string;
  patientId: string;
  linkedToAppointment: boolean;
  note: StructuredNote;
}) {
  const reduce = useReducedMotion();
  // Fetched now, not at page load: the queue moved while this consultation was open.
  const [next, setNext] = useState<AppointmentDto | null>(null);
  useEffect(() => {
    getAppointments()
      .then((all) => setNext(all.filter((a) => a.status === "WAITING").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ?? null))
      .catch(() => {}); // the dashboard link is always there
  }, []);

  return (
    <div role="status" className="flex flex-1 items-center justify-center py-12">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className="panel w-full max-w-2xl px-8 py-10 text-center"
      >
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true" className="mx-auto">
          <motion.circle
            cx="28"
            cy="28"
            r="26"
            stroke="var(--color-accent-500)"
            strokeWidth="1.5"
            initial={reduce ? false : { pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
          />
          <motion.path
            d="M18 29l7 7 13-15"
            stroke="var(--color-accent-700)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, ease: EASE, delay: 0.35 }}
          />
        </svg>
        <h1 className="display mt-6 text-[32px] text-ink">Consultation saved</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
          Added to {patientName}&apos;s history.
          {linkedToAppointment ? " The appointment is marked completed." : ""}
        </p>
        <div className="mt-8 rounded-md bg-surface-2/60 px-5 py-4 text-left">
          <StructuredNoteView note={note} showMissing={false} compact />
        </div>

        {next ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent-500/30 bg-accent-50/50 px-5 py-3.5 text-left">
            <div className="min-w-0">
              <p className="eyebrow text-accent-700">Next · {formatTime(next.scheduledAt)}</p>
              <p className="mt-0.5 truncate text-[15px] font-semibold text-ink">{next.patient.name}</p>
              <p className="truncate text-[13px] text-ink-3">{next.reason}</p>
            </div>
            <Button render={<SafeLink href={`/patients/${next.patientId}/consultation?appointmentId=${encodeURIComponent(next.id)}`} />}>
              Start consultation
              <ArrowRightIcon />
            </Button>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant={next ? "secondary" : "primary"} render={<SafeLink href="/" />}>
            Back to dashboard
          </Button>
          <Button variant="ghost" render={<SafeLink href={`/patients/${patientId}`} />}>
            View {patientName.split(" ")[0]}&apos;s record
            <ArrowRightIcon />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
