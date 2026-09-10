import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeLink } from "@/components/shared/safe-link";
import { PatientRecord, PatientRecordSkeleton } from "@/components/patient/patient-record";
import { ClinicalTimeline, ClinicalTimelineSkeleton } from "@/components/patient/clinical-timeline";
import { getAppointments } from "@/lib/api/appointments";
import { isApiError } from "@/lib/api/client";
import { getPatient, getPatientConsultations } from "@/lib/api/patients";

export const dynamic = "force-dynamic";

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const { id } = await params;
  const { appointmentId } = await searchParams;
  const consultHref = appointmentId
    ? `/patients/${id}/consultation?appointmentId=${encodeURIComponent(appointmentId)}`
    : `/patients/${id}/consultation`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <SafeLink
          href="/"
          className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
        >
          <ArrowLeftIcon className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
          Today&apos;s appointments
        </SafeLink>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[34px] text-ink sm:text-[38px]">Patient record</h1>
            <p className="mt-1.5 text-[14px] text-ink-3">Demographics, medications, conditions and consultation history.</p>
          </div>
          <Button size="lg" render={<SafeLink href={consultHref} />}>
            Start consultation
            <ArrowRightIcon />
          </Button>
        </div>
      </div>

      <Suspense fallback={<PatientRecordSkeleton />}>
        <Record id={id} appointmentId={appointmentId} />
      </Suspense>

      <Suspense fallback={<ClinicalTimelineSkeleton />}>
        <History id={id} />
      </Suspense>
    </div>
  );
}

async function Record({ id, appointmentId }: { id: string; appointmentId?: string }) {
  let patient, consultations, appointments;
  try {
    [patient, consultations, appointments] = await Promise.all([
      getPatient(id),
      getPatientConsultations(id),
      appointmentId ? getAppointments() : Promise.resolve([]),
    ]);
  } catch (err) {
    if (isApiError(err, "NOT_FOUND")) notFound();
    throw err;
  }
  const appointment = appointments.find((a) => a.id === appointmentId) ?? null;
  return <PatientRecord patient={patient} consultations={consultations} appointment={appointment} />;
}

async function History({ id }: { id: string }) {
  let consultations;
  try {
    consultations = await getPatientConsultations(id);
  } catch (err) {
    if (isApiError(err, "NOT_FOUND")) notFound();
    throw err;
  }
  return <ClinicalTimeline consultations={consultations} patientId={id} />;
}
