export function EmptyState({
  icon,
  title,
  body,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      {icon ? (
        <div className="relative mb-5 flex size-12 items-center justify-center rounded-full bg-surface text-ink-3 shadow-1">
          <span aria-hidden="true" className="absolute inset-[-10px] rounded-full border border-line/70" />
          <span aria-hidden="true" className="absolute inset-[-22px] rounded-full border border-line/40" />
          {icon}
        </div>
      ) : null}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-sm leading-relaxed text-ink-3">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
