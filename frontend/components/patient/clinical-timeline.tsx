import { HistoryIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import type { ConsultationDto } from "@/lib/api/types";
import { pluralize } from "@/lib/format";
import { HistorySummary } from "./history-summary";
import { TimelineEntry } from "./timeline-entry";

export function ClinicalTimeline({ consultations, patientId }: { consultations: ConsultationDto[]; patientId: string }) {
  const rows = [...consultations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section aria-labelledby="history-h" className="flex flex-col">
      <div className="flex items-baseline justify-between gap-4 pb-4">
        <h2 id="history-h" className="text-[20px] font-semibold tracking-[-0.015em] text-ink">
          Previous consultations
        </h2>
        {rows.length > 0 ? <p className="num text-[13px] text-ink-3">{pluralize(rows.length, "visit")}</p> : null}
      </div>

      {rows.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={<HistoryIcon className="size-5" aria-hidden="true" />}
            title="No consultations yet"
            body="This patient's first consultation will start their clinical timeline here."
          />
        </div>
      ) : (
        <>
          <HistorySummary patientId={patientId} visits={rows.length} />
          <div className="panel px-5">
          <ol className="relative">
          <span aria-hidden="true" className="absolute top-3 bottom-3 left-[7.25rem] hidden w-px bg-line md:block" />
          {rows.map((c, i) => (
            <TimelineEntry key={c.id} consultation={c} index={i} />
          ))}
          </ol>
          </div>
        </>
      )}
    </section>
  );
}

export function ClinicalTimelineSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading consultations" className="flex flex-col">
      <div className="flex items-baseline justify-between pb-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3.5 w-14" />
      </div>
      <div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[1fr] gap-4 border-b border-line py-5 md:grid-cols-[6.5rem_1.5rem_1fr]">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="hidden size-2.5 rounded-full md:block" />
            <div className="space-y-2.5">
              <Skeleton className="h-5 w-72 max-w-full" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
