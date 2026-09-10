"use client";

import { motion, useReducedMotion } from "motion/react";
import { SPRING } from "@/components/shared/reveal";

/** One quiet page transition. Content arrives from below; nothing slides sideways. */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
