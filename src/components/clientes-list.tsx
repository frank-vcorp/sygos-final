"use client";

import { SortableResponsiveList } from "@/components/sortable-list";
import { MobileCard, RecordLink } from "@/components/ui";

export type ClienteListRow = {
  id: string;
  name: string;
  isSystem: boolean;
  ownerLabel: string;
  creditLabel: string;
  invoiceLabel: string;
};

export function ClientesList({ rows }: { rows: ClienteListRow[] }) {
  return (
    <SortableResponsiveList
      rows={rows}
      initialOrder={{ mode: "column", columnId: "name", direction: "asc" }}
      rowKey={(row) => row.id}
      columns={[
        {
          id: "name",
          header: "Cliente",
          value: (row) => row.name,
          cell: (row) => (
            <>
              <RecordLink href={`/clientes/${row.id}`}>{row.name}</RecordLink>
              {row.isSystem ? " · intercompañía" : ""}
            </>
          ),
        },
        {
          id: "owner",
          header: "Responsable",
          value: (row) => row.ownerLabel,
          cell: (row) => row.ownerLabel,
        },
        {
          id: "credit",
          header: "Crédito",
          value: (row) => row.creditLabel,
          cell: (row) => row.creditLabel,
        },
        {
          id: "invoice",
          header: "Factura",
          value: (row) => row.invoiceLabel,
          cell: (row) => row.invoiceLabel,
        },
      ]}
      mobileCard={(row) => (
        <MobileCard
          href={`/clientes/${row.id}`}
          title={row.name}
          meta={row.isSystem ? "Intercompañía" : undefined}
        >
          <p>Responsable: {row.ownerLabel}</p>
          <p>
            Crédito: {row.creditLabel} · Factura: {row.invoiceLabel}
          </p>
        </MobileCard>
      )}
    />
  );
}