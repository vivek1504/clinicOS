"use client";

import { useEffect } from "react";
import { useNavigationBlocker } from "@/lib/navigation-blocker";

/** Blocks in-app navigation (via SafeLink / useGuardedRouter) and tab close while `dirty`. */
export function useUnsavedGuard(dirty: boolean) {
  const { setIsBlocked } = useNavigationBlocker();

  useEffect(() => {
    setIsBlocked(dirty);
    return () => setIsBlocked(false);
  }, [dirty, setIsBlocked]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
