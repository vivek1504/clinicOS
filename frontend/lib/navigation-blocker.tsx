"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/dialog";

interface Ctx {
  isBlocked: boolean;
  setIsBlocked: (blocked: boolean) => void;
  /** Resolves true when the doctor agrees to leave (or nothing is blocked). */
  confirmLeave: () => Promise<boolean>;
}

const NavigationBlockerContext = createContext<Ctx>({
  isBlocked: false,
  setIsBlocked: () => {},
  confirmLeave: async () => true,
});

export function NavigationBlockerProvider({ children }: { children: React.ReactNode }) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [asking, setAsking] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirmLeave = useCallback(() => {
    if (!isBlocked) return Promise.resolve(true);
    setAsking(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [isBlocked]);

  const settle = (ok: boolean) => {
    setAsking(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const value = useMemo(() => ({ isBlocked, setIsBlocked, confirmLeave }), [isBlocked, confirmLeave]);
  return (
    <NavigationBlockerContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={asking}
        title="Leave this consultation?"
        body="Your notes and the structured draft have not been saved. They will be lost if you leave now."
        confirmLabel="Leave without saving"
        cancelLabel="Stay"
        destructive
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </NavigationBlockerContext.Provider>
  );
}

export function useNavigationBlocker() {
  return useContext(NavigationBlockerContext);
}

/** router.push / back that honour the unsaved-changes guard. */
export function useGuardedRouter() {
  const router = useRouter();
  const { setIsBlocked, confirmLeave } = useNavigationBlocker();

  return useMemo(
    () => ({
      push: async (href: string) => {
        if (!(await confirmLeave())) return;
        setIsBlocked(false);
        router.push(href);
      },
      back: async () => {
        if (!(await confirmLeave())) return;
        setIsBlocked(false);
        router.back();
      },
      /** Bypass the guard, e.g. right after a successful save. */
      pushUnguarded: (href: string) => {
        setIsBlocked(false);
        router.push(href);
      },
      refresh: () => router.refresh(),
    }),
    [confirmLeave, router, setIsBlocked],
  );
}
