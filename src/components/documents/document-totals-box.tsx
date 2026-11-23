import type { ReactNode } from "react";

export type DocumentTotalRow = {
  key: string;
  label: string;
  value: string;
  emphasis?: boolean;
  dividerBefore?: boolean;
};

export function DocumentTotalsBox({
  rows,
  emptyFallback,
}: {
  rows: DocumentTotalRow[];
  emptyFallback?: ReactNode;
}) {
  if (rows.length === 0) {
    return emptyFallback ? <div className="mt-6 flex justify-end">{emptyFallback}</div> : null;
  }
  return (
    <div className="mt-6 flex justify-end">
      <dl className="w-[280px] space-y-2 rounded-lg border border-[var(--line)] p-4">
        {rows.map((row) => (
          <div
            key={row.key}
            className={`flex justify-between gap-4${row.emphasis ? " border-t border-[var(--line)] pt-3 text-lg font-semibold text-[var(--accent)]" : ""}${row.dividerBefore && !row.emphasis ? " border-t border-[var(--line)] pt-2" : ""}`}
          >
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}