import { Skeleton } from "@/components/ui/skeleton";

export default function ConsultationLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6" aria-busy="true" aria-label="Loading consultation">
      <div className="flex flex-col gap-5">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-end justify-between">
          <div className="space-y-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="panel space-y-4 p-5 lg:col-span-2 xl:col-span-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-20" />
          <div className="grid grid-cols-2 gap-4 pt-2 md:grid-cols-4 xl:grid-cols-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
        <div className="panel min-h-[420px] p-6 xl:min-h-[560px]">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-2 h-3.5 w-56" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <div className="panel min-h-[420px] p-6 xl:min-h-[560px]">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3.5 w-52" />
        </div>
      </div>
    </div>
  );
}
