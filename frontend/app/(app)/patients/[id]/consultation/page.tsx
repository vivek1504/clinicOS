import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConsultationWorkspace } from "@/components/consultation/consultation-workspace";
import { isApiError } from "@/lib/api/client";
import { getPatient, getPatientConsultations } from "@/lib/api/patients";

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

  let patient, history;
  try {
    [patient, history] = await Promise.all([getPatient(id), getPatientConsultations(id)]);
  } catch (err) {
    if (isApiError(err, "NOT_FOUND")) notFound();
    throw err;
  }

  return <ConsultationWorkspace patient={patient} history={history} appointmentId={appointmentId} />;
}
