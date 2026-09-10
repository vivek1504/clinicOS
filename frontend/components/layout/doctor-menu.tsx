"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, type DoctorDto } from "@/lib/api/auth";
import { useNavigationBlocker } from "@/lib/navigation-blocker";

export function DoctorMenu({ doctor }: { doctor: DoctorDto }) {
  const router = useRouter();
  const { confirmLeave, setIsBlocked } = useNavigationBlocker();
  const [busy, setBusy] = useState(false);
  const initial = doctor.name.replace(/^Dr\.?\s*/i, "").charAt(0).toUpperCase() || "D";

  const out = async () => {
    if (!(await confirmLeave())) return; // unsaved consultation guard applies here too
    setBusy(true);
    try {
      await signOut();
    } finally {
      setIsBlocked(false);
      router.push("/sign-in");
      router.refresh();
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-flex size-6 items-center justify-center rounded-full bg-accent-100 text-[11px] font-semibold text-accent-800"
      >
        {initial}
      </span>
      <span className="font-medium text-ink">{doctor.name}</span>
      <Button variant="ghost" size="icon-sm" className="ml-1 text-ink-4 hover:text-ink" aria-label="Sign out" onClick={out} loading={busy}>
        {busy ? null : <LogOutIcon />}
      </Button>
    </div>
  );
}
