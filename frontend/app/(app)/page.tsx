import { Suspense, cache } from "react";
import { redirect } from "next/navigation";
import { ClinicOverview } from "@/components/dashboard/clinic-overview";
import { DayRail, DayRailSkeleton } from "@/components/dashboard/day-rail";
import { PatientDirectory, PatientDirectorySkeleton } from "@/components/dashboard/patient-directory";
import { Schedule, ScheduleSkeleton } from "@/components/dashboard/schedule";
import { getAppointments } from "@/lib/api/appointments";
import { getMe } from "@/lib/api/auth";
import { getPatients } from "@/lib/api/patients";
import { formatTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Both header figures and the schedule read the same list; one request per render. */
const loadAppointments = cache((date?: string) => getAppointments(date));

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const HEADLINE_DATE = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA").format(now); // YYYY-MM-DD
  // Forward only, like the desk: a past date in the URL falls back to today.
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today ? date : today;
  const isToday = selected === today;
  const doctor = await getMe(); // memoized: the layout already fetched it for this request
  if (doctor.role === "RECEPTIONIST") redirect("/front-desk");

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="display text-[32px] text-ink sm:text-[36px]">
          {greeting(now.getHours())}, <span className="italic">{doctor.name}</span>
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-3">
          <p suppressHydrationWarning>{HEADLINE_DATE.format(isToday ? now : new Date(`${selected}T12:00:00`))}</p>
          <span aria-hidden="true" className="hidden text-ink-3 sm:inline">—</span>
          <Suspense fallback={<ClinicOverview loading />}>
            <Overview date={selected} isToday={isToday} />
          </Suspense>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Suspense fallback={<ScheduleSkeleton />}>
          <Timeline date={selected} isToday={isToday} />
        </Suspense>
        <Suspense fallback={<DayRailSkeleton />}>
          <Rail date={selected} isToday={isToday} />
        </Suspense>
      </div>

      <Suspense fallback={<PatientDirectorySkeleton />}>
        <Directory />
      </Suspense>
    </div>
  );
}

async function Overview({ date, isToday }: { date: string; isToday: boolean }) {
  const appointments = await loadAppointments(isToday ? undefined : date);
  const count = (s: string) => appointments.filter((a) => a.status === s).length;
  return (
    <ClinicOverview
      total={appointments.length}
      waiting={count("WAITING")}
      booked={count("BOOKED")}
      inConsultation={count("IN_CONSULTATION")}
      completed={count("COMPLETED")}
      noShow={count("NO_SHOW")}
    />
  );
}

async function Directory() {
  const patients = await getPatients();
  return <PatientDirectory patients={[...patients].sort((a, b) => a.name.localeCompare(b.name))} />;
}

async function Rail({ date, isToday }: { date: string; isToday: boolean }) {
  const appointments = await loadAppointments(isToday ? undefined : date);
  return <DayRail appointments={appointments} isToday={isToday} />;
}

async function Timeline({ date, isToday }: { date: string; isToday: boolean }) {
  const appointments = await loadAppointments(isToday ? undefined : date);
  const rows = appointments
    .map((a) => ({ ...a, time: formatTime(a.scheduledAt) }))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return <Schedule rows={rows} date={date} isToday={isToday} />;
}
