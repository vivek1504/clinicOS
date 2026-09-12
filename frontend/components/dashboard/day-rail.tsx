import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/shared/card";
import { SafeLink } from "@/components/shared/safe-link";
import { getPatient, getPatientConsultations } from "@/lib/api/patients";
import type { AppointmentDto } from "@/lib/api/types";
import { formatAgo, formatTime, pluralize } from "@/lib/format";

/** Right rail: who is next, with the context a doctor wants before calling them in. */
export async function DayRail({ appointments, isToday }: { appointments: AppointmentDto[]; isToday: boolean }) {
  const sorted = [...appointments].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const next = sorted.find((a) => a.status === "IN_CONSULTATION") ?? sorted.find((a) => a.status === "WAITING") ?? null;
  // The card is the doctor's pre-visit read, so it also carries how often and how recently this patient has been seen.
  const [patient, visits] = next ? await Promise.all([getPatient(next.patientId).catch(() => null), getPatientConsultations(next.patientId).catch(() => [])]) : [null, []];
  const last = visits[0] ?? null;
  const notArrived = sorted.filter((a) => a.status === "BOOKED").length;

  const inRoom = next?.status === "IN_CONSULTATION";

  return (
    <div className="flex flex-col gap-5">
      {/* Same heading block as the schedule's, so both panels share a top edge. Keyed on who is up so a change fades in rather than cutting. */}
      <div key={`${next?.id ?? "none"}-${next?.status ?? ""}`} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        <div className="pb-4">
          <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-ink">{inRoom ? "In the room" : "Up next"}</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {next ? (inRoom ? "Consultation in progress" : "Checked in and ready") : notArrived ? "Waiting for check-ins" : sorted.length ? "Every patient seen" : "No appointments"}
          </p>
        </div>
        <Card>
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
                  <div>
                    <dt className="eyebrow">Last visit</dt>
                    <dd className={`mt-1 font-medium ${last ? "text-ink" : "text-ink-3"}`}>
                      {last ? (
                        <>
                          {formatAgo(last.createdAt)}
                          {last.chiefComplaint ? <span className="font-normal text-ink-3"> · {last.chiefComplaint}</span> : null}
                          <span className="font-normal text-ink-3"> · {pluralize(visits.length, "visit")} on record</span>
                        </>
                      ) : (
                        "First visit"
                      )}
                    </dd>
                  </div>
                </dl>
              ) : null}
              <div className="mt-5 flex gap-2">
                <Button className="flex-1" render={<SafeLink href={`/patients/${next.patientId}/consultation?appointmentId=${encodeURIComponent(next.id)}`} />}>
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
      </div>

    </div>
  );
}

export function DayRailSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="pb-4">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="mt-1.5 h-4 w-40" />
      </div>
      <div className="panel p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="mt-5 h-9 w-full" />
      </div>
    </div>
  );
}
