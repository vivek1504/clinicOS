"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EASE, SPRING } from "@/components/shared/reveal";
import { SafeLink } from "@/components/shared/safe-link";

export function SavedState({ patientName, patientId, linkedToAppointment }: { patientName: string; patientId: string; linkedToAppointment: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div role="status" className="flex flex-1 items-center justify-center py-12">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className="panel w-full max-w-xl px-8 py-10 text-center"
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
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Button render={<SafeLink href={`/patients/${patientId}`} />}>
            View patient history
            <ArrowRightIcon />
          </Button>
          <Button variant="secondary" render={<SafeLink href="/" />}>
            Back to dashboard
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
