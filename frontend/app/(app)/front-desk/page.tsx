import type { Metadata } from "next";
import { UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SafeLink } from "@/components/shared/safe-link";
import { PatientDirectory } from "@/components/dashboard/patient-directory";
import { DeskActions } from "@/components/reception/desk-actions";
import { DeskQueue } from "@/components/reception/desk-queue";
import { getAppointments, getDoctors } from "@/lib/api/appointments";
import { getPatients } from "@/lib/api/patients";
import { formatTime, pluralize } from "@/lib/format";
import { requireRole } from "@/lib/role";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Front desk" };

const HEADLINE_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export default async function FrontDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; register?: string; book?: string; walkIn?: string; patientId?: string; appointmentId?: string }>;
}) {
  const me = await requireRole("RECEPTIONIST", "/");
  const { date, register, book, walkIn, patientId, appointmentId } = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA").format(new Date());
  // The desk works forward only: a past date in the URL (typed, or an old link) falls back to today.
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today ? date : today;
  const isToday = selected === today;

  const [appointments, patients, doctors] = await Promise.all([getAppointments(isToday ? undefined : selected), getPatients(), getDoctors()]);
  const rows = appointments.map((a) => ({ ...a, time: formatTime(a.scheduledAt) })).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const count = (s: string) => rows.filter((a) => a.status === s).length;
  const live = rows.filter((a) => a.status !== "CANCELLED").length;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-[40px] text-ink sm:text-[46px]">
            Front desk<span className="text-ink-3">, </span>
            <span className="italic">{me.name.split(" ")[0]}</span>
          </h1>
          <p className="num mt-2 text-[15px] text-ink-3" suppressHydrationWarning>
            {HEADLINE_DATE.format(isToday ? new Date() : new Date(`${selected}T12:00:00`))}
            <span aria-hidden="true"> — </span>
            {pluralize(live, "appointment")} · {count("BOOKED")} to check in · <span className={count("WAITING") ? "font-medium text-wait-700" : ""}>{count("WAITING")} waiting</span> ·{" "}
            {count("COMPLETED")} seen
          </p>
        </div>
        <DeskActions
          key={`${register ?? ""}-${book ?? ""}-${walkIn ?? ""}-${patientId ?? ""}-${appointmentId ?? ""}`}
          patients={patients}
          doctors={doctors}
          date={selected}
          initial={{ register: register === "1", book: book === "1", walkIn: walkIn === "1", patientId, reschedule: appointmentId ? (appointments.find((a) => a.id === appointmentId) ?? null) : null }}
        />
      </header>

      <DeskQueue rows={rows} date={selected} isToday={isToday} />

      <PatientDirectory
        patients={[...patients].sort((a, b) => a.name.localeCompare(b.name))}
        action={
          <Button variant="secondary" size="sm" render={<SafeLink href={`/front-desk?date=${selected}&register=1`} />}>
            <UserPlusIcon />
            Register
          </Button>
        }
      />
    </div>
  );
}
