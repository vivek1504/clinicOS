import { CheckIcon } from "lucide-react";
import type { AppointmentStatus } from "@/lib/api/types";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  WAITING: "Waiting",
  IN_CONSULTATION: "In consultation",
  COMPLETED: "Completed",
};

/* Waiting and in-consultation need attention, so they carry colour; completed stays quiet. */
const STYLE: Record<AppointmentStatus, string> = {
  WAITING: "bg-wait-100 text-wait-700",
  IN_CONSULTATION: "bg-accent-50 text-accent-700",
  COMPLETED: "bg-transparent text-ink-3 shadow-hair",
};

export function StatusBadge({ status, className = "" }: { status: AppointmentStatus; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full pl-2 pr-2.5 text-xs font-medium transition-colors duration-200 ${STYLE[status]} ${className}`}
    >
      {status === "COMPLETED" ? (
        <CheckIcon className="size-3" strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${status === "WAITING" ? "bg-wait-700/80" : "bg-accent-500 animate-pulse-dot"}`}
        />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}
