import { Skeleton } from "@/components/ui/skeleton";
import { pluralize } from "@/lib/format";

type Props =
  | { loading: true }
  | { loading?: false; total: number; waiting: number; booked: number; inConsultation: number; completed: number; noShow: number };

/** One line of day metadata under the greeting. The queue is the hero; these are supporting figures, not KPI cards. */
export function ClinicOverview(props: Props) {
  if (props.loading) return <Skeleton className="h-4 w-72" aria-busy="true" />;

  const parts: { text: string; tone?: string }[] = [
    { text: pluralize(props.total, "appointment") },
    { text: `${props.waiting} waiting`, tone: props.waiting > 0 ? "text-wait-700" : undefined },
    ...(props.booked > 0 ? [{ text: `${props.booked} not yet arrived` }] : []),
    { text: `${props.inConsultation} in consultation`, tone: props.inConsultation > 0 ? "text-accent-700" : undefined },
    { text: `${props.completed} completed` },
    ...(props.noShow > 0 ? [{ text: `${props.noShow} no-show` }] : []),
  ];

  return (
    <p className="num text-[14px] text-ink-3">
      {parts.map((p, i) => (
        <span key={p.text}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          <span className={p.tone ? `font-medium ${p.tone}` : ""}>{p.text}</span>
        </span>
      ))}
    </p>
  );
}
