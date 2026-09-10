import { Skeleton } from "@/components/ui/skeleton";
import { PatientRecordSkeleton } from "@/components/patient/patient-record";
import { ClinicalTimelineSkeleton } from "@/components/patient/clinical-timeline";

export default function PatientLoading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-end justify-between">
          <div className="space-y-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
      <PatientRecordSkeleton />
      <ClinicalTimelineSkeleton />
    </div>
  );
}
