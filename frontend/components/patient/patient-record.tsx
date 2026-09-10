import { ActivityIcon, AlertTriangleIcon, CalendarIcon, PhoneIcon, PillIcon, ShieldAlertIcon, UserIcon } from "lucide-react";
import { Card } from "@/components/shared/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppointmentDto, ConsultationDto, PatientDto } from "@/lib/api/types";
import { formatDate, formatGender } from "@/lib/format";
import { CopyId } from "./copy-id";

export function PatientRecord({
  patient,
  consultations,
  appointment,
}: {
  patient: PatientDto;
  consultations: ConsultationDto[];
  appointment: AppointmentDto | null;
}) {
  const medications = medicationsFrom(consultations);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <IdentityCard patient={patient} appointment={appointment} />
      <MedicationsCard medications={medications} />
      <ConditionsCard conditions={patient.conditions} />
      <AllergiesCard allergies={patient.allergies} />
    </div>
  );
}

function IdentityCard({ patient, appointment }: { patient: PatientDto; appointment: AppointmentDto | null }) {
  const initials = patient.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const rows: { icon: React.ReactNode; label: string; value: React.ReactNode }[] = [
    { icon: <CalendarIcon />, label: "Age", value: `${patient.age} years` },
    { icon: <UserIcon />, label: "Gender", value: formatGender(patient.gender) },
    { icon: <CalendarIcon />, label: "Date of birth", value: formatDate(patient.dob) },
    { icon: <PhoneIcon />, label: "Phone", value: <span className="num">{patient.phone}</span> },
    {
      icon: <ActivityIcon />,
      label: "Conditions",
      value: patient.conditions.length ? patient.conditions.join(", ") : <span className="text-ink-4">None recorded</span>,
    },
  ];

  return (
    <Card>
      <div className="rounded-lg bg-surface-2/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-accent-100 text-[15px] font-semibold text-accent-800"
          >
            {initials}
          </span>
          {appointment ? (
            <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-[11px] font-medium text-accent-700">Booked today</span>
          ) : null}
        </div>
        <div className="mt-3">
          <CopyId value={patient.id} />
        </div>
        <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.015em] text-ink">{patient.name}</h2>
        <p className="mt-0.5 text-[12px] text-ink-3">
          {patient.age} years · {formatGender(patient.gender)}
          {appointment ? ` · ${appointment.reason}` : ""}
        </p>
      </div>

      <h3 className="mt-5 text-[14px] font-semibold text-ink">Personal information</h3>
      <dl className="mt-2 divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1.25rem_7rem_1fr] items-baseline gap-2 py-2.5 text-[13px]">
            <span className="self-center text-ink-4 [&_svg]:size-3.5" aria-hidden="true">
              {r.icon}
            </span>
            <dt className="text-ink-3">{r.label}</dt>
            <dd className="font-medium text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
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
        <Empty>No medications have been mentioned in this patient&apos;s consultation notes.</Empty>
      ) : (
        <ul className="space-y-3">
          {medications.map((m) => (
            <li key={m.name} className="rounded-lg border border-line p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700" aria-hidden="true">
                  <PillIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink">{m.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-3">{m.context ? `Noted during: ${m.context}` : "Noted in consultation"}</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[12px]">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="size-3.5 text-ink-4" aria-hidden="true" />
                  <dt className="text-ink-3">First noted</dt>
                  <dd className="ml-auto num font-medium text-ink">{formatDate(m.since)}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="size-3.5 text-ink-4" aria-hidden="true" />
                  <dt className="text-ink-3">Last noted</dt>
                  <dd className="ml-auto num font-medium text-ink">{formatDate(m.lastNoted)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ConditionsCard({ conditions }: { conditions: string[] }) {
  return (
    <Card title="Diagnoses & conditions" aside={conditions.length ? `${conditions.length} on record` : undefined}>
      {conditions.length === 0 ? (
        <Empty>No chronic conditions or diagnoses on record.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {conditions.map((c) => (
            <li key={c} className="flex items-center gap-3 rounded-lg border border-line px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2" aria-hidden="true">
                <ActivityIcon className="size-4" />
              </span>
              <p className="flex-1 text-[14px] font-medium text-ink">{c}</p>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-ink-2">On record</span>
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
        <ul className="space-y-2.5" aria-label="Allergies">
          {allergies.map((a) => (
            <li key={a} className="flex items-center gap-3 rounded-lg border border-danger-200 bg-danger-100/40 px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-danger-700" aria-hidden="true">
                <AlertTriangleIcon className="size-4" />
              </span>
              <p className="flex-1 text-[14px] font-medium text-ink">{a}</p>
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-medium text-danger-700">Allergy</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-3">{children}</p>;
}

export function PatientRecordSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-busy="true">
      <div className="panel p-5">
        <div className="rounded-lg bg-surface-2/70 p-4">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="mt-4 h-3 w-24" />
          <Skeleton className="mt-2 h-6 w-44" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="panel p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-5 h-28 rounded-lg" />
        <Skeleton className="mt-3 h-28 rounded-lg" />
      </div>
      <div className="panel p-5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-5 h-14 rounded-lg" />
        <Skeleton className="mt-2.5 h-14 rounded-lg" />
      </div>
      <div className="panel p-5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-5 h-14 rounded-lg" />
      </div>
    </div>
  );
}
