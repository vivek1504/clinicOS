import { Suspense, cache } from "react";
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
  const selected = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const isToday = selected === today;
  const doctor = await getMe(); // memoized: the layout already fetched it for this request

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-[40px] text-ink sm:text-[46px]">
            {greeting(now.getHours())}, <span className="italic">{doctor.name}</span>
          </h1>
          <p className="mt-2 text-[15px] text-ink-3" suppressHydrationWarning>
            {HEADLINE_DATE.format(isToday ? now : new Date(`${selected}T12:00:00`))}
          </p>
        </div>
        <Suspense key={`ov-${selected}`} fallback={<ClinicOverview loading />}>
          <Overview date={selected} isToday={isToday} />
        </Suspense>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Suspense key={`sc-${selected}`} fallback={<ScheduleSkeleton />}>
          <Timeline date={selected} isToday={isToday} />
        </Suspense>
        <Suspense key={`rail-${selected}`} fallback={<DayRailSkeleton />}>
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
      inConsultation={count("IN_CONSULTATION")}
      completed={count("COMPLETED")}
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
