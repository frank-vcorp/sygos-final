"use client";

import { ClientNameLink } from "@/components/client-entity-links";
import { SlaCountdown } from "@/components/sla-countdown";
import { SortableResponsiveList } from "@/components/sortable-list";
import { Badge, MobileCard, RecordLink } from "@/components/ui";
import { QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, type QuoteType } from "@/lib/quote-meta";

export type CotizacionListRow = {
  id: string;
  folio: string;
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  quoteType: string;
  status: string;
  totalLabel: string;
  totalSort: number | string;
  slaDueAt: string | Date | null;
  slaText: string;
  createdAt: string | Date;
};

function quoteBadgeTone(status: string) {
  if (status === "PENDIENTE_DECISION") return "warn" as const;
  if (status.startsWith("AUTORIZADA")) return "ok" as const;
  if (status === "NO_AUTORIZADA") return "danger" as const;
  return "neutral" as const;
}

export function CotizacionesList({
  rows,
  canEditClient,
}: {
  rows: CotizacionListRow[];
  canEditClient: boolean;
}) {
  return (
    <SortableResponsiveList
      rows={rows}
      initialOrder={{ mode: "column", columnId: "createdAt", direction: "desc" }}
      rowKey={(row) => row.id}
      columns={[
        {
          id: "folio",
          header: "Folio",
          value: (row) => row.folio,
          cell: (row) => <RecordLink href={`/cotizaciones/${row.id}`}>{row.folio}</RecordLink>,
        },
        {
          id: "cliente",
          header: "Cliente",
          value: (row) => row.clientName,
          cell: (row) => (
            <ClientNameLink clientId={row.clientId} name={row.clientName} isSystem={row.clientIsSystem} canEdit={canEditClient} />
          ),
        },
        {
          id: "tipo",
          header: "Tipo",
          value: (row) => QUOTE_TYPE_LABEL[row.quoteType as QuoteType] ?? row.quoteType,
          cell: (row) => QUOTE_TYPE_LABEL[row.quoteType as QuoteType] ?? row.quoteType,
        },
        {
          id: "estado",
          header: "Estado",
          value: (row) => QUOTE_STATUS_LABEL[row.status] ?? row.status,
          cell: (row) => (
            <Badge tone={quoteBadgeTone(row.status)}>{QUOTE_STATUS_LABEL[row.status] ?? row.status}</Badge>
          ),
        },
        {
          id: "total",
          header: "Total",
          value: (row) => row.totalSort,
          cell: (row) => row.totalLabel,
        },
        {
          id: "sla",
          header: "SLA",
          value: (row) => row.slaDueAt ?? row.slaText,
          cell: (row) =>
            row.slaDueAt ? (
              <SlaCountdown dueAt={new Date(row.slaDueAt)} className="text-xs tabular-nums" />
            ) : (
              <span className="text-xs text-[var(--muted)]">{row.slaText}</span>
            ),
        },
        {
          id: "createdAt",
          header: "Alta",
          value: (row) => row.createdAt,
          cell: (row) => (
            <span className="text-xs text-[var(--muted)]">
              {new Date(row.createdAt).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}
            </span>
          ),
        },
      ]}
      mobileCard={(row) => (
        <MobileCard
          href={`/cotizaciones/${row.id}`}
          title={row.folio}
          meta={<Badge tone={quoteBadgeTone(row.status)}>{QUOTE_STATUS_LABEL[row.status] ?? row.status}</Badge>}
          footer={
            <ClientNameLink clientId={row.clientId} name={row.clientName} isSystem={row.clientIsSystem} canEdit={canEditClient} />
          }
        >
          <p>
            {QUOTE_TYPE_LABEL[row.quoteType as QuoteType] ?? row.quoteType} · {row.totalLabel}
          </p>
          <p>
            SLA:{" "}
            {row.slaDueAt ? (
              <SlaCountdown dueAt={new Date(row.slaDueAt)} className="text-xs tabular-nums" />
            ) : (
              row.slaText
            )}
          </p>
        </MobileCard>
      )}
    />
  );
}