import type { ReactNode } from "react";

export function DocumentLegalNotes({
  title = "Condiciones comerciales",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6 rounded-lg border border-[var(--line)] bg-[#f7f8f9] p-4 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</p>
      <div className="mt-2 space-y-1 text-[var(--muted)]">{children}</div>
    </section>
  );
}