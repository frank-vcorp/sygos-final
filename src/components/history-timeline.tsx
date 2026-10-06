export type HistoryTimelineItem = {
  id: string;
  createdAt: Date;
  summary: string;
  authorName?: string | null;
};

export function HistoryTimeline({
  items,
  title = "Historial",
  className = "",
}: {
  items: HistoryTimelineItem[];
  title?: string;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-[var(--line)] bg-white shadow-[0_1px_2px_rgba(7,59,120,0.05)] ${className}`}>
      <header className="flex items-center justify-between border-b border-[var(--line)] bg-[#f7fafc] px-5 py-4">
        <div>
          <h2 className="font-semibold text-[#0b1f3a]">{title}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">Bitácora ordenada de cambios y decisiones.</p>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-bold text-[var(--accent)]">{items.length}</span>
      </header>
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">Todavía no hay movimientos registrados.</p>
      ) : (
        <ol className="relative mx-5 my-5 border-l-2 border-[#d7e7ee] pl-5">
          {items.map((item, index) => (
            <li key={item.id} className={index === items.length - 1 ? "relative pb-1" : "relative pb-6"}>
              <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[var(--ok)] ring-2 ring-[#d7e7ee]" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <time className="text-xs font-medium text-[var(--muted)]">{formatHistoryDate(item.createdAt)}</time>
                <span className="text-[#b6c1ce]" aria-hidden>·</span>
                <span className="rounded-full bg-[#eef3f8] px-2 py-0.5 text-[11px] font-semibold text-[#38506c]">{item.authorName || "Sistema"}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#24364d]">{item.summary}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function formatHistoryDate(value: Date) {
  return value.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
