import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { SafeLink } from "@/components/shared/safe-link";
import { BookingForm } from "@/components/reception/booking-form";
import { getAppointments, getDoctors } from "@/lib/api/appointments";
import { getPatients } from "@/lib/api/patients";
import { requireRole } from "@/lib/role";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book appointment" };

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; date?: string; walkIn?: string; appointmentId?: string }>;
}) {
  await requireRole("RECEPTIONIST", "/");
  const { patientId, date, walkIn, appointmentId } = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;

  const [patients, doctors, existing] = await Promise.all([
    getPatients(),
    getDoctors(),
    appointmentId ? getAppointments(selected === today ? undefined : selected).then((as) => as.find((a) => a.id === appointmentId) ?? null) : null,
  ]);
  if (appointmentId && !existing) notFound();

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <SafeLink href={`/front-desk?date=${selected}`} className="group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink">
        <ArrowLeftIcon className="size-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
        Front desk
      </SafeLink>
      <div>
        <h1 className="display text-[34px] text-ink">{existing ? "Reschedule" : walkIn ? "Walk-in" : "Book appointment"}</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">
          {existing ? `${existing.patient.name} with ${existing.doctor.name}.` : "Times stay as booked; the doctor sees patients in check-in order."}
        </p>
      </div>
      <BookingForm
        patients={[...patients].sort((a, b) => a.name.localeCompare(b.name))}
        doctors={doctors}
        defaults={{ patientId, date: selected, walkIn: walkIn === "1" }}
        existing={existing}
      />
    </div>
  );
}
