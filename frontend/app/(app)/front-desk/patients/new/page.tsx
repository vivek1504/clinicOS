import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";
import { SafeLink } from "@/components/shared/safe-link";
import { PatientForm } from "@/components/reception/patient-form";
import { requireRole } from "@/lib/role";

export const metadata: Metadata = { title: "Register patient" };

export default async function NewPatientPage() {
  await requireRole("RECEPTIONIST", "/");
  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <SafeLink href="/front-desk" className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink">
        <ArrowLeftIcon className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
        Front desk
      </SafeLink>
      <div>
        <h1 className="display text-[34px] text-ink">Register patient</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">Phone numbers are checked against existing patients so nobody gets two records.</p>
      </div>
      <PatientForm />
    </div>
  );
}
