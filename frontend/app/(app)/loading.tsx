import { ClinicOverview } from "@/components/dashboard/clinic-overview";
import { DayRailSkeleton } from "@/components/dashboard/day-rail";
import { PatientDirectorySkeleton } from "@/components/dashboard/patient-directory";
import { ScheduleSkeleton } from "@/components/dashboard/schedule";
import { Skeleton } from "@/components/ui/skeleton";

export default function TodayLoading() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <Skeleton className="h-11 w-[420px] max-w-[80vw]" />
          <Skeleton className="h-4 w-48" />
        </div>
        <ClinicOverview loading />
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ScheduleSkeleton />
        <DayRailSkeleton />
      </div>
      <PatientDirectorySkeleton />
    </div>
  );
}
