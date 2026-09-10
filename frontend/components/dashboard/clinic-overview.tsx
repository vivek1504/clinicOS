"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";

type Props =
  | { loading: true }
  | { loading?: false; total: number; waiting: number; inConsultation: number; completed: number };

/** Inline clinical figures, not dashboard cards. */
export function ClinicOverview(props: Props) {
  const items = props.loading
    ? [
        { label: "Appointments", value: null },
        { label: "Waiting", value: null },
        { label: "In consultation", value: null },
        { label: "Completed", value: null },
      ]
    : [
        { label: "Appointments", value: props.total },
        { label: "Waiting", value: props.waiting, tone: props.waiting > 0 ? "text-wait-700" : "" },
        { label: "In consultation", value: props.inConsultation, tone: props.inConsultation > 0 ? "text-accent-700" : "" },
        { label: "Completed", value: props.completed },
      ];

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:gap-0 sm:divide-x sm:divide-line" aria-busy={props.loading || undefined}>
      {items.map((it, i) => (
        <div key={it.label} className={`sm:px-7 ${i === 0 ? "sm:pl-0" : ""} ${i === items.length - 1 ? "sm:pr-0" : ""}`}>
          <dt className="eyebrow">{it.label}</dt>
          <dd className={`mt-1 num text-[28px] font-medium leading-none tracking-[-0.02em] ${"tone" in it && it.tone ? it.tone : "text-ink"}`}>
            {it.value === null ? <Skeleton className="mt-1 h-6 w-8" /> : <CountUp value={it.value} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(from.current, value, {
      type: "spring",
      bounce: 0,
      visualDuration: 0.6,
      onUpdate: (v) => setAnimated(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <>{reduce ? value : animated}</>;
}
