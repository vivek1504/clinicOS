import { Suspense, cache } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { BookForPatient } from "@/components/reception/book-for-patient";
import { EditPatient } from "@/components/reception/edit-patient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeLink } from "@/components/shared/safe-link";
import { PatientRecord, PatientRecordSkeleton } from "@/components/patient/patient-record";
import { ClinicalTimeline, ClinicalTimelineSkeleton } from "@/components/patient/clinical-timeline";
import { getAppointments, getDoctors, getPatientAppointments } from "@/lib/api/appointments";
import { Card } from "@/components/shared/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatTime, pluralize } from "@/lib/format";
import { getMe } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/client";
import { getPatient, getPatientConsultations } from "@/lib/api/patients";
import { todaysVisit } from "@/lib/visit";

export const dynamic = "force-dynamic";

/** Header action, record and timeline all read these; one request each per render. */
const loadConsultations = cache((id: string) => getPatientConsultations(id));
const loadAppointments = cache(() => getAppointments());
const loadPatient = cache((id: string) => getPatient(id));

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const { id } = await params;
  const { appointmentId } = await searchParams;
  const me = await getMe(); // memoized with the layout's call
  const frontDesk = me.role === "RECEPTIONIST";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <SafeLink
          href={frontDesk ? "/front-desk" : "/"}
          className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeftIcon className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
          {frontDesk ? "Front desk" : "Today's appointments"}
        </SafeLink>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[34px] text-ink sm:text-[38px]">Patient record</h1>
            <p className="mt-1.5 text-[14px] text-ink-3">{frontDesk ? "Details and allergies. Clinical notes are visible to doctors only." : "Clinical context and consultation history."}</p>
          </div>
          {frontDesk ? (
            <Suspense fallback={<Skeleton className="h-10 w-72" />}>
              <DeskActions id={id} />
            </Suspense>
          ) : (
            <Suspense fallback={<Skeleton className="h-11 w-44" />}>
              <ConsultAction id={id} appointmentId={appointmentId} />
            </Suspense>
          )}
        </div>
      </div>

      <Suspense fallback={<PatientRecordSkeleton />}>
        <Record id={id} appointmentId={appointmentId} withNotes={!frontDesk} />
      </Suspense>

      {frontDesk ? null : (
        <Suspense fallback={<ClinicalTimelineSkeleton />}>
          <History id={id} />
        </Suspense>
      )}
    </div>
  );
}

async function loadVisit(id: string, appointmentId?: string) {
  return todaysVisit({ patientId: id, appointmentId, appointments: await loadAppointments() });
}

/** Once today's appointment is completed, the page points at the note instead of offering another consultation. */
async function ConsultAction({ id, appointmentId }: { id: string; appointmentId?: string }) {
  const visit = await loadVisit(id, appointmentId);
  if (visit.recorded) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-accent-50 px-2.5 text-[12px] font-medium text-accent-700">
          <CheckIcon className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
          Consultation recorded today
        </span>
        <Button size="lg" variant="secondary" render={<a href="#history-h" />}>
          View today&apos;s note
        </Button>
      </div>
    );
  }
  if (visit.appointment && (visit.appointment.status === "BOOKED" || visit.appointment.status === "NO_SHOW")) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Button size="lg" disabled>
          Start consultation
        </Button>
        <p className="text-[12px] text-ink-3">{visit.appointment.status === "BOOKED" ? "Not checked in yet; the front desk checks patients in" : "Marked absent; the front desk marks arrival"}</p>
      </div>
    );
  }
  if (visit.blockedBy) {
    const who = visit.blockedBy.patient.name;
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Button size="lg" disabled title={`${who} first`}>
          Start consultation
        </Button>
        <p className="text-[12px] text-ink-3">
          {visit.blockedBy.status === "IN_CONSULTATION" ? `${who} is in consultation` : `${who} is ahead in the queue`}
        </p>
      </div>
    );
  }
  const href = visit.appointment
    ? `/patients/${id}/consultation?appointmentId=${encodeURIComponent(visit.appointment.id)}`
    : `/patients/${id}/consultation`;
  return (
    <Button size="lg" render={<SafeLink href={href} />}>
      {visit.appointment?.status === "IN_CONSULTATION" ? "Continue consultation" : "Start consultation"}
      <ArrowRightIcon />
    </Button>
  );
}

/** Front desk only: edit the patient or book for them, both as modals over the record. */
async function DeskActions({ id }: { id: string }) {
  let patient;
  try {
    patient = await loadPatient(id);
  } catch (err) {
    if (isApiError(err, "NOT_FOUND")) notFound();
    throw err;
  }
  const doctors = await getDoctors();
  return (
    <div className="flex flex-wrap gap-2">
      <EditPatient patient={patient} />
      <BookForPatient patient={patient} doctors={doctors} />
    </div>
  );
}

/** `withNotes` false for the front desk: the consultation list is a doctor-only endpoint. */
async function Record({ id, appointmentId, withNotes }: { id: string; appointmentId?: string; withNotes: boolean }) {
  let patient;
  try {
    patient = await loadPatient(id);
  } catch (err) {
    if (isApiError(err, "NOT_FOUND")) notFound();
    throw err;
  }
  const [visit, consultations] = await Promise.all([loadVisit(id, appointmentId), withNotes ? loadConsultations(id) : null]);
  if (!withNotes) {
    return (
      <PatientRecord
        patient={patient}
        consultations={null}
        appointment={visit.appointment}
        layout="desk"
        aside={
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <Appointments id={id} />
          </Suspense>
        }
      />
    );
  }
  return <PatientRecord patient={patient} consultations={consultations} appointment={visit.appointment} />;
}

/** Front desk: the patient's bookings, newest first. Doctors get the clinical timeline instead. */
async function Appointments({ id }: { id: string }) {
  const rows = await getPatientAppointments(id);
  return (
    <Card title="Appointments" aside={rows.length ? pluralize(rows.length, "booking") : undefined}>
      {rows.length === 0 ? (
        <p className="py-2 text-[13px] text-ink-3">No appointments on record.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-[14px]">
              <span className="num w-44 shrink-0 text-ink">
                {formatDate(a.scheduledAt)} · {formatTime(a.scheduledAt)}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink-2">{a.reason}</span>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function History({ id }: { id: string }) {
  let consultations;
  try {
    consultations = await loadConsultations(id);
  } catch (err) {
    if (isApiError(err, "NOT_FOUND")) notFound();
    throw err;
  }
  return <ClinicalTimeline consultations={consultations} patientId={id} />;
}
