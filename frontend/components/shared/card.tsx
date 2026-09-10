export function Card({
  title,
  aside,
  className = "",
  bodyClassName = "",
  children,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          {aside ? <div className="text-[12px] text-ink-3">{aside}</div> : null}
        </header>
      ) : null}
      <div className={`px-5 pb-5 ${title ? "" : "pt-5"} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
