import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { SafeLink } from "@/components/shared/safe-link";
import { PatientForm } from "@/components/reception/patient-form";
import { isApiError } from "@/lib/api/client";
import { getPatient } from "@/lib/api/patients";
import { requireRole } from "@/lib/role";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit patient" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("RECEPTIONIST", "/");
  const { id } = await params;
  let patient;
  try {
    patient = await getPatient(id);
  } catch (err) {
    if (isApiError(err, "NOT_FOUND")) notFound();
    throw err;
  }
  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <SafeLink href={`/patients/${id}`} className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink">
        <ArrowLeftIcon className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
        {patient.name}
      </SafeLink>
      <div>
        <h1 className="display text-[34px] text-ink">Edit details</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">Demographics, contact, allergies and known conditions.</p>
      </div>
      <PatientForm existing={patient} />
    </div>
  );
}
