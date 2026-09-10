"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

/** Critically damped spring (Apple: damping 1.0, response 0.4). No overshoot: nothing here was flicked. */
export const SPRING = { type: "spring", bounce: 0, visualDuration: 0.4 } as const;
/** Snappier variant for small, frequent UI (list items, toggles). */
export const SPRING_QUICK = { type: "spring", bounce: 0, visualDuration: 0.28 } as const;
/** Kept for non-physical reveals such as path drawing. */
const EASE = [0.16, 1, 0.3, 1] as const;

/** Fade-up on mount. `index` staggers siblings; pass `layout` for list reflow. */
export function Reveal({
  index = 0,
  delay = 0,
  y = 8,
  children,
  ...props
}: HTMLMotionProps<"div"> & { index?: number; delay?: number; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: delay + Math.min(index, 12) * 0.04 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export { EASE };
