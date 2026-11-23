import type { ReactNode } from "react";
import { PrintButton } from "@/components/print-button";
import { TextLink } from "@/components/ui";
import { companyThemeDataAttribute } from "@/lib/company-theme";

export function DocumentPrintShell({
  companyCode,
  backHref,
  backLabel = "Volver",
  embedded,
  children,
}: {
  companyCode: string;
  backHref?: string;
  backLabel?: string;
  embedded?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto max-w-4xl space-y-4 print:max-w-none${embedded ? " p-0" : ""}`}>
      {embedded ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          {backHref ? <TextLink href={backHref}>{backLabel}</TextLink> : <span />}
          <PrintButton />
        </div>
      )}
      <article
        data-company={companyThemeDataAttribute(companyCode)}
        className="sygos-document quote-document overflow-hidden rounded-lg border border-[var(--line)] bg-white text-sm print:rounded-none print:border-0"
      >
        {children}
      </article>
    </div>
  );
}