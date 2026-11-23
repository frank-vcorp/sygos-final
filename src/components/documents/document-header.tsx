import { CompanyLogo } from "@/components/brand-logo";
import { companyDisplayName, issuerCompactLines, type DocumentCompanyFields } from "@/lib/document-print";

export function DocumentHeader({
  company,
  docTitle,
  folio,
  issued,
  timeLine,
  statusBadge,
}: {
  company: DocumentCompanyFields;
  docTitle: string;
  folio: string;
  issued: string;
  timeLine?: string | null;
  statusBadge?: { label: string; className?: string } | null;
}) {
  const issuerLines = issuerCompactLines(company);
  const systron = company.code === "SYSTRON";
  return (
    <header className="doc-print-header border-b-4 border-[var(--accent)] px-6 py-6 sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <CompanyLogo code={company.code} />
          {systron ? (
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.32em] text-[var(--accent-secondary)]">Industrial</p>
          ) : null}
          <p className={`font-semibold${systron ? " mt-1" : " mt-3"}`}>{companyDisplayName(company)}</p>
          {issuerLines.map((line) => (
            <p key={line} className="text-xs text-[var(--muted)]">
              {line}
            </p>
          ))}
        </div>
        <div className="min-w-52 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{docTitle}</p>
          <p className="mt-1 text-3xl font-semibold text-[var(--accent)]">{folio}</p>
          <p className="mt-1">{issued}</p>
          {timeLine ? <p className="mt-1 text-xs text-[var(--muted)]">{timeLine}</p> : null}
          {statusBadge ? (
            <p
              className={
                statusBadge.className
                ?? "mt-2 inline-flex rounded-full border border-[var(--accent-secondary)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"
              }
            >
              {statusBadge.label}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}