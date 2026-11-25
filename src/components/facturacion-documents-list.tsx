"use client";

import { useMemo } from "react";
import { ClientNameLink } from "@/components/client-entity-links";
import { FolioCell } from "@/components/folio-cell";
import { SortableResponsiveList, type SortableColumnDef } from "@/components/sortable-list";
import { Badge, MobileCard, RecordLink } from "@/components/ui";
import { money } from "@/lib/money";

const KIND: Record<string, string> = {
  FACTURA: "Factura",
  REMISION: "Remisión",
  FACTURA_LIBRE: "Factura libre",
  FACTURA_INTERCOMPANIA: "Factura a SYSTRON",
  NOTA_CREDITO: "Nota de crédito",
};

export type FacturacionListPpdCobranza = {
  balanceLine: string | null;
  complementLabel: string;
  complementWarn: boolean;
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
  paymentMethodCode?: string | null;
  ppdCobranza?: FacturacionListPpdCobranza;
};

function PaymentMethodColumnCell({ row }: { row: FacturacionListRow }) {
  const code = row.paymentMethodCode ?? "—";
  if (code !== "PPD") {
    return <span>{code}</span>;
  }
  const cobranza = row.ppdCobranza;
  if (!cobranza || cobranza.complementLabel === "—") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">PPD</span>
        <span className="text-[11px] text-[var(--muted)]">—</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">PPD</span>
      <div className="text-[11px] leading-snug text-[var(--muted)]">
        {cobranza.balanceLine ? <p>{cobranza.balanceLine}</p> : null}
        <p className="flex flex-wrap items-center gap-1">
          <span>Complemento:</span>
          {cobranza.complementWarn ? (
            <Badge tone="warn">{cobranza.complementLabel}</Badge>
          ) : (
            <span>{cobranza.complementLabel}</span>
          )}
        </p>
      </div>
    </div>
  );
}

function buildColumns(
  showPaymentMethodColumn: boolean,
  canEditClient: boolean,
): SortableColumnDef<FacturacionListRow>[] {
  const leading: SortableColumnDef<FacturacionListRow>[] = [
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
  ];

  const linkColumns: SortableColumnDef<FacturacionListRow>[] = showPaymentMethodColumn
    ? [
        {
          id: "metodoPago",
          header: "Método de pago",
          value: (row) => {
            const code = row.paymentMethodCode ?? "";
            if (code !== "PPD") return code;
            return `${code} ${row.ppdCobranza?.complementLabel ?? ""} ${row.ppdCobranza?.balanceLine ?? ""}`;
          },
          cell: (row) => <PaymentMethodColumnCell row={row} />,
        },
      ]
    : [
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
      ];

  const trailing: SortableColumnDef<FacturacionListRow>[] = [
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
  ];

  return [...leading, ...linkColumns, ...trailing];
}

export function FacturacionDocumentsList({
  rows,
  canEditClient,
  showPaymentMethodColumn = false,
}: {
  rows: FacturacionListRow[];
  canEditClient: boolean;
  showPaymentMethodColumn?: boolean;
}) {
  const columns = useMemo(() => buildColumns(showPaymentMethodColumn, canEditClient), [showPaymentMethodColumn, canEditClient]);

  return (
    <SortableResponsiveList
      rows={rows}
      initialOrder={{ mode: "column", columnId: "createdAt", direction: "desc" }}
      rowKey={(row) => row.id}
      columns={columns}
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
            {showPaymentMethodColumn ? (
              <PaymentMethodMobileMeta row={row} />
            ) : (
              <>
                {row.diagnosisFolio ? <p>DX: {row.diagnosisFolio}</p> : null}
                {row.osFolio ? <p>OS: {row.osFolio}</p> : null}
              </>
            )}
            <p className="mt-1 font-medium">{money(row.total)}</p>
          </MobileCard>
        );
      }}
    />
  );
}

function PaymentMethodMobileMeta({ row }: { row: FacturacionListRow }) {
  if ((row.paymentMethodCode ?? "—") !== "PPD") {
    return <p>Método: {row.paymentMethodCode}</p>;
  }
  const cobranza = row.ppdCobranza;
  return (
    <div className="text-xs text-[var(--muted)]">
      <p className="font-medium text-[var(--ink)]">PPD</p>
      {cobranza?.balanceLine ? <p>{cobranza.balanceLine}</p> : <p>—</p>}
      {cobranza && cobranza.complementLabel !== "—" ? (
        <p className="flex flex-wrap items-center gap-1">
          <span>Complemento:</span>
          {cobranza.complementWarn ? (
            <Badge tone="warn">{cobranza.complementLabel}</Badge>
          ) : (
            <span>{cobranza.complementLabel}</span>
          )}
        </p>
      ) : null}
    </div>
  );
}