import type { ReactNode } from "react";
import {
  clientCommercialCompactLines,
  clientFiscalCompactLines,
  type DocumentClientCommercialFields,
  type DocumentClientFiscalFields,
  type DocumentContactFields,
} from "@/lib/document-print";

export function DocumentPartyGrid({
  clientLabel = "Cliente",
  clientName,
  clientLines,
  right,
}: {
  clientLabel?: string;
  clientName: string;
  clientLines?: string[];
  right: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-lg bg-[#f7f8f9] p-4 sm:grid-cols-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{clientLabel}</p>
        <p className="mt-1 text-base font-semibold">{clientName}</p>
        {clientLines?.map((line) => (
          <p key={line} className="text-xs text-[var(--muted)]">
            {line}
          </p>
        ))}
      </div>
      <div className="sm:text-right">{right}</div>
    </section>
  );
}

export function buildCommercialClientParty(
  client: DocumentClientCommercialFields,
  contact?: DocumentContactFields | null,
) {
  return {
    clientName: client.name,
    clientLines: clientCommercialCompactLines(client, contact),
  };
}

export function buildFiscalClientParty(
  client: DocumentClientFiscalFields,
  contact?: DocumentContactFields | null,
) {
  return {
    clientName: client.satLegalName,
    clientLines: clientFiscalCompactLines(client, contact),
  };
}