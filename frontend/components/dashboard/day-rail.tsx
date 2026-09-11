import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/shared/card";
import { SafeLink } from "@/components/shared/safe-link";
import { getPatient } from "@/lib/api/patients";
import type { AppointmentDto } from "@/lib/api/types";
import { formatTime } from "@/lib/format";

/** Right rail: who is next (with the context a doctor wants before calling them in) and how the day is going. */
export async function DayRail({ appointments, isToday }: { appointments: AppointmentDto[]; isToday: boolean }) {
  const sorted = [...appointments].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const next = sorted.find((a) => a.status === "IN_CONSULTATION") ?? sorted.find((a) => a.status === "WAITING") ?? null;
  const patient = next ? await getPatient(next.patientId).catch(() => null) : null;
  const done = sorted.filter((a) => a.status === "COMPLETED").length;
  const upcoming = sorted.filter((a) => (a.status === "WAITING" || a.status === "BOOKED") && a.id !== next?.id);
  const notArrived = sorted.filter((a) => a.status === "BOOKED").length;

  return (
    <div className="flex flex-col gap-5">
      <Card title={next?.status === "IN_CONSULTATION" ? "In the room" : "Up next"}>
        {next ? (
          <>
            <p className="text-[20px] font-semibold tracking-[-0.015em] text-ink">{next.patient.name}</p>
            <p className="mt-0.5 text-[13px] text-ink-3">
              <span className="num font-mono">{formatTime(next.scheduledAt)}</span> · {next.reason}
            </p>
            {patient ? (
              <dl className="mt-4 space-y-3 border-t border-line pt-4 text-[13px]">
                <div>
                  <dt className="eyebrow">{patient.allergies.length === 1 ? "Allergy" : "Allergies"}</dt>
                  <dd className={`mt-1 font-medium ${patient.allergies.length ? "text-danger-700" : "text-ink-3"}`}>
                    {patient.allergies.length ? patient.allergies.join(", ") : "No known allergies"}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Existing conditions</dt>
                  <dd className={`mt-1 font-medium ${patient.conditions.length ? "text-ink" : "text-ink-3"}`}>
                    {patient.conditions.length ? patient.conditions.join(", ") : "None recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">Age</dt>
                  <dd className="mt-1 font-medium text-ink">{patient.age} years</dd>
                </div>
              </dl>
            ) : null}
            <div className="mt-5 flex gap-2">
              <Button variant="secondary" className="flex-1" render={<SafeLink href={`/patients/${next.patientId}/consultation?appointmentId=${encodeURIComponent(next.id)}`} />}>
                {next.status === "IN_CONSULTATION" ? "Continue consultation" : "Start consultation"}
                <ArrowRightIcon />
              </Button>
              <Button variant="secondary" render={<SafeLink href={`/patients/${next.patientId}?appointmentId=${encodeURIComponent(next.id)}`} />}>
                Record
              </Button>
            </div>
          </>
        ) : (
          <div className="py-2 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-accent-50 text-accent-700" aria-hidden="true">
              <CheckIcon className="size-4" strokeWidth={2.5} />
            </span>
            <p className="mt-3 text-[15px] font-medium text-ink">{notArrived ? "Nobody waiting yet" : sorted.length ? "All caught up" : "Nothing scheduled"}</p>
            <p className="mt-1 text-[13px] text-ink-3">
              {notArrived
                ? `${notArrived} booked, not yet checked in.`
                : sorted.length
                  ? "Every patient on this list has been seen."
                  : isToday
                    ? "New bookings appear here automatically."
                    : "Pick another day to see its schedule."}
            </p>
          </div>
        )}
      </Card>

      {sorted.length > 0 ? (
        <Card title="Day progress" aside={<span className="num">{done} of {sorted.length} seen</span>}>
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${done} of ${sorted.length} appointments completed`}>
            {sorted.map((a) => (
              <span
                key={a.id}
                className={`flex-1 ${a.status === "COMPLETED" ? "bg-accent-600" : a.status === "IN_CONSULTATION" ? "bg-accent-300" : a.status === "NO_SHOW" || a.status === "CANCELLED" ? "bg-line" : "bg-line-strong"}`}
              />
            ))}
          </div>
          {upcoming.length > 0 ? (
            <ul className="mt-4 divide-y divide-line text-[13px]">
              {upcoming.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <span className="num w-16 shrink-0 font-mono text-[12px] text-ink-3">{formatTime(a.scheduledAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{a.patient.name}</span>
                  {a.status === "BOOKED" ? <span className="shrink-0 text-[11px] text-ink-3">not arrived</span> : null}
                </li>
              ))}
              {upcoming.length > 4 ? <li className="py-2 text-[12px] text-ink-3">+{upcoming.length - 4} more waiting</li> : null}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-ink-3">{next ? "No one else is waiting after this patient." : "Nothing left in the queue."}</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}

export function DayRailSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="panel p-5">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="mt-4 h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="mt-5 h-9 w-full" />
      </div>
      <div className="panel p-5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
        <Skeleton className="mt-4 h-4 w-48" />
      </div>
    </div>
  );
}
