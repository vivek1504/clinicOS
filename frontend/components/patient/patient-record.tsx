import { CalendarIcon, PhoneIcon, ShieldAlertIcon, UserIcon } from "lucide-react";
import { Card } from "@/components/shared/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppointmentDto, ConsultationDto, PatientDto } from "@/lib/api/types";
import { formatDate, formatGender } from "@/lib/format";
import { CopyId } from "./copy-id";

/** Clinical relevance first: identity, then what can change today's decisions (allergies, conditions), then demographics. */
export function PatientRecord({
  patient,
  consultations,
  appointment,
  layout = "doctor",
  aside,
}: {
  patient: PatientDto;
  /** null for the front desk: medications are read from consultation notes, which they do not see. */
  consultations: ConsultationDto[] | null;
  appointment: AppointmentDto | null;
  /** "desk": phone and date of birth always visible, and `aside` (the appointments list) becomes the main column. */
  layout?: "doctor" | "desk";
  aside?: React.ReactNode;
}) {
  if (layout === "desk") {
    return (
      <div className="grid gap-5">
        <IdentityCard patient={patient} appointment={appointment} expanded />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          {aside}
          <div className="grid content-start gap-5">
            <AllergiesCard allergies={patient.allergies} />
            <ConditionsCard conditions={patient.conditions} />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <IdentityCard patient={patient} appointment={appointment} />
      <AllergiesCard allergies={patient.allergies} />
      <ConditionsCard conditions={patient.conditions} />
      {consultations ? <MedicationsCard medications={medicationsFrom(consultations)} /> : null}
    </div>
  );
}

/** `expanded`: the front desk works from phone and date of birth, so they sit in the open instead of behind a toggle. */
function IdentityCard({ patient, appointment, expanded = false }: { patient: PatientDto; appointment: AppointmentDto | null; expanded?: boolean }) {
  const initials = patient.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    { icon: <CalendarIcon />, label: "Date of birth", value: formatDate(patient.dob) },
    { icon: <UserIcon />, label: "Gender", value: formatGender(patient.gender) },
    { icon: <PhoneIcon />, label: "Phone", value: <span className="num">{patient.phone}</span> },
  ];

  return (
    <Card>
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-100 text-[15px] font-semibold text-accent-800"
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-ink">{patient.name}</h2>
          <p className="mt-0.5 text-[13px] text-ink-3">
            {patient.age} · {formatGender(patient.gender)}
          </p>
          {appointment ? (
            <p className="mt-2 text-[13px] text-ink">
              <span className="eyebrow mr-2">Today</span>
              {appointment.reason}
            </p>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
          {rows.map((r) => (
            <div key={r.label} className="min-w-0">
              <dt className="eyebrow">{r.label}</dt>
              <dd className="mt-1 truncate text-[14px] font-medium text-ink">{r.value}</dd>
            </div>
          ))}
          <div className="min-w-0">
            <dt className="eyebrow">Patient ID</dt>
            <dd className="mt-1">
              <CopyId value={patient.id} />
            </dd>
          </div>
        </dl>
      ) : (
      <details className="group mt-5">
        <summary className="cursor-pointer list-none text-[13px] font-medium text-ink-3 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Demographics</span>
          <span className="hidden group-open:inline">Hide demographics</span>
        </summary>
        <dl className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[1.25rem_7rem_minmax(0,1fr)] items-baseline gap-2 py-2.5 text-[13px]">
              <span className="self-center text-ink-3 [&_svg]:size-3.5" aria-hidden="true">
                {r.icon}
              </span>
              <dt className="text-ink-3">{r.label}</dt>
              <dd className="font-medium text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2">
          <CopyId value={patient.id} />
        </div>
      </details>
      )}
    </Card>
  );
}

interface Medication {
  name: string;
  since: string;
  lastNoted: string;
  context: string | null;
}

/** Medications named in saved notes. Context only: this is not a prescription record. */
function medicationsFrom(consultations: ConsultationDto[]): Medication[] {
  const byName = new Map<string, Medication>();
  for (const c of [...consultations].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    for (const m of c.finalNote.medicationsMentioned) {
      const key = m.toLowerCase();
      const prev = byName.get(key);
      if (prev) {
        prev.lastNoted = c.createdAt;
        prev.context = c.finalNote.chiefComplaint ?? prev.context;
      } else {
        byName.set(key, { name: m, since: c.createdAt, lastNoted: c.createdAt, context: c.finalNote.chiefComplaint });
      }
    }
  }
  return [...byName.values()].sort((a, b) => b.lastNoted.localeCompare(a.lastNoted));
}

function MedicationsCard({ medications }: { medications: Medication[] }) {
  return (
    <Card title="Medications mentioned" aside={medications.length ? `${medications.length} in notes` : undefined}>
      {medications.length === 0 ? (
        <Empty>No medications mentioned in this patient&apos;s notes.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {medications.map((m) => (
            <li key={m.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-ink">{m.name}</p>
                {m.context ? <p className="truncate text-[12px] text-ink-3">Noted during: {m.context}</p> : null}
              </div>
              <p className="num text-[12px] text-ink-3">
                {m.since === m.lastNoted ? formatDate(m.since) : `${formatDate(m.since)} – ${formatDate(m.lastNoted)}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ConditionsCard({ conditions }: { conditions: string[] }) {
  return (
    <Card title="Conditions" aside={conditions.length ? `${conditions.length} on record` : undefined}>
      {conditions.length === 0 ? (
        <Empty>No chronic conditions or diagnoses on record.</Empty>
      ) : (
        <ul className="divide-y divide-line">
          {conditions.map((c) => (
            <li key={c} className="py-2.5 text-[14px] font-medium text-ink">
              {c}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AllergiesCard({ allergies }: { allergies: string[] }) {
  return (
    <Card
      title="Allergies"
      aside={
        allergies.length ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-danger-700">
            <ShieldAlertIcon className="size-3.5" aria-hidden="true" />
            Check before prescribing
          </span>
        ) : undefined
      }
    >
      {allergies.length === 0 ? (
        <Empty>No known allergies.</Empty>
      ) : (
        <ul className="divide-y divide-danger-200" aria-label="Allergies">
          {allergies.map((a) => (
            <li key={a} className="py-2.5 text-[15px] font-semibold text-danger-700">
              {a}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-[13px] text-ink-3">{children}</p>;
}

export function PatientRecordSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-busy="true">
      <div className="panel p-5">
        <div className="flex gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="mt-5 h-4 w-28" />
      </div>
      <div className="panel p-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-5 h-5 w-40" />
      </div>
      <div className="panel p-5">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-5 h-5 w-48" />
        <Skeleton className="mt-3 h-5 w-36" />
      </div>
      <div className="panel p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-5 h-5 w-full" />
        <Skeleton className="mt-3 h-5 w-2/3" />
      </div>
    </div>
  );
}
