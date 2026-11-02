"use client";

import { AuthorizeExitWithoutDocumentButton } from "@/components/exit-without-document-actions";
import { TextLink } from "@/components/ui";

export function CeoExitWithoutDocumentPanel({
  rows,
}: {
  rows: Array<{
    caseId: string;
    version: number;
    folio: string;
    equipmentFolio: string;
    clientName: string;
  }>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No hay solicitudes pendientes.</p>;
  }
  return (
    <ul className="divide-y divide-[var(--line)] text-sm">
      {rows.map((row) => (
        <li key={row.caseId} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0">
          <div className="min-w-0">
            <TextLink href={`/operacion/${row.caseId}`}>{row.folio}</TextLink>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {row.equipmentFolio} · {row.clientName}
            </p>
          </div>
          <AuthorizeExitWithoutDocumentButton
            caseId={row.caseId}
            version={row.version}
            returnTo="/panel"
          />
        </li>
      ))}
    </ul>
  );
}
