"use client";

import { ClientNameLink } from "@/components/client-entity-links";
import { FolioCell } from "@/components/folio-cell";
import { SortableResponsiveList } from "@/components/sortable-list";
import { Badge, MobileCard, RecordLink } from "@/components/ui";
import { money } from "@/lib/money";

const KIND: Record<string, string> = {
  FACTURA: "Factura",
  REMISION: "Remisión",
  FACTURA_LIBRE: "Factura libre",
  FACTURA_INTERCOMPANIA: "Factura a SYSTRON",
  NOTA_CREDITO: "Nota de crédito",
};

export type FacturacionListRow = {
  id: string;
  folio: string;
  diagnosisFolio: string | null;
  diagnosisHref: string | null;
  osFolio: string | null;
  osHref: string | null;
  kind: string;
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  status: string;
  total: number;
  createdAt: string | Date;
  fiscalTone: "neutral" | "ok" | "warn" | "danger" | null;
  fiscalLabel: string | null;
  detailHref: string | null;
};

export function FacturacionDocumentsList({
  rows,
  canEditClient,
}: {
  rows: FacturacionListRow[];
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
          cell: (row) =>
            row.detailHref ? (
              <RecordLink href={row.detailHref}>{row.folio}</RecordLink>
            ) : (
              <span className="font-semibold text-slate-900">{row.folio}</span>
            ),
        },
        {
          id: "dx",
          header: "DX",
          value: (row) => row.diagnosisFolio ?? "",
          cell: (row) => <FolioCell folio={row.diagnosisFolio} href={row.diagnosisHref} />,
        },
        {
          id: "os",
          header: "OS",
          value: (row) => row.osFolio ?? "",
          cell: (row) => <FolioCell folio={row.osFolio} href={row.osHref} />,
        },
        {
          id: "tipo",
          header: "Tipo",
          value: (row) => KIND[row.kind] ?? row.kind,
          cell: (row) => KIND[row.kind] ?? row.kind,
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
          id: "estado",
          header: "Estado",
          value: (row) => row.status,
          cell: (row) => {
            const statusLabel = row.status === "SOLICITADA" ? "Solicitada" : row.status === "EMITIDA" ? "Emitida" : row.status;
            return <Badge tone={row.status === "SOLICITADA" ? "warn" : "neutral"}>{statusLabel}</Badge>;
          },
        },
        {
          id: "fiscal",
          header: "Fiscal",
          value: (row) => row.fiscalLabel ?? "",
          cell: (row) =>
            row.fiscalLabel && row.fiscalTone ? <Badge tone={row.fiscalTone}>{row.fiscalLabel}</Badge> : "—",
        },
        {
          id: "total",
          header: "Total",
          value: (row) => row.total,
          cell: (row) => money(row.total),
        },
        {
          id: "createdAt",
          header: "Emisión",
          value: (row) => row.createdAt,
          cell: (row) => (
            <span className="text-xs text-[var(--muted)]">
              {new Date(row.createdAt).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}
            </span>
          ),
        },
      ]}
      mobileCard={(row) => {
        const statusLabel = row.status === "SOLICITADA" ? "Solicitada" : row.status === "EMITIDA" ? "Emitida" : row.status;
        return (
          <MobileCard
            href={row.detailHref ?? undefined}
            title={row.folio}
            meta={<Badge tone={row.status === "SOLICITADA" ? "warn" : "neutral"}>{statusLabel}</Badge>}
            footer={
              <ClientNameLink clientId={row.clientId} name={row.clientName} isSystem={row.clientIsSystem} canEdit={canEditClient} />
            }
          >
            <p>{KIND[row.kind] ?? row.kind}</p>
            {row.diagnosisFolio ? <p>DX: {row.diagnosisFolio}</p> : null}
            {row.osFolio ? <p>OS: {row.osFolio}</p> : null}
            <p className="mt-1 font-medium">{money(row.total)}</p>
          </MobileCard>
        );
      }}
    />
  );
}
