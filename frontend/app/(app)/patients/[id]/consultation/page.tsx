import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConsultationWorkspace } from "@/components/consultation/consultation-workspace";
import { getAppointments } from "@/lib/api/appointments";
import { isApiError } from "@/lib/api/client";
import { getPatient, getPatientConsultations } from "@/lib/api/patients";
import { todaysVisit } from "@/lib/visit";
import { requireRole } from "@/lib/role";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New consultation" };

export default async function ConsultationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const { id } = await params;
  const { appointmentId } = await searchParams;
  await requireRole("DOCTOR", "/front-desk");

  let patient, history, appointments;
  try {
    [patient, history, appointments] = await Promise.all([getPatient(id), getPatientConsultations(id), getAppointments()]);
  } catch (err) {
    if (isApiError(err, "NOT_FOUND")) notFound();
    throw err;
  }

  // Today's appointment is already completed: a stale link lands on the record, where the saved note is.
  if (todaysVisit({ patientId: id, appointmentId, appointments }).recorded) {
    redirect(`/patients/${id}`);
  }

  return <ConsultationWorkspace patient={patient} history={history} appointmentId={appointmentId} />;
}
