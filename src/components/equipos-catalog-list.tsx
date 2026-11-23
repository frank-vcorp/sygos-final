"use client";

import { ClientNameLink } from "@/components/client-entity-links";
import { SortableResponsiveList } from "@/components/sortable-list";
import { Badge, MobileCard, RecordLink } from "@/components/ui";
import { CUSTODY_LABEL, type Custody } from "@/lib/custody";

export type EquipoListRow = {
  id: string;
  folio: string;
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  identification: string;
  custody: string;
  createdAt: string | Date;
  detailHref: string;
};

export function EquiposCatalogList({
  rows,
  canEditClient,
}: {
  rows: EquipoListRow[];
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
          cell: (row) => <RecordLink href={row.detailHref}>{row.folio}</RecordLink>,
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
          id: "identificacion",
          header: "Identificación",
          value: (row) => row.identification,
          cell: (row) => row.identification,
        },
        {
          id: "custodia",
          header: "Custodia",
          value: (row) => CUSTODY_LABEL[row.custody as Custody] ?? row.custody,
          cell: (row) => <Badge>{CUSTODY_LABEL[row.custody as Custody] ?? row.custody}</Badge>,
        },
        {
          id: "createdAt",
          header: "Registro",
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
          href={row.detailHref}
          title={row.folio}
          meta={<Badge>{CUSTODY_LABEL[row.custody as Custody] ?? row.custody}</Badge>}
          footer={
            <ClientNameLink clientId={row.clientId} name={row.clientName} isSystem={row.clientIsSystem} canEdit={canEditClient} />
          }
        >
          <p>{row.identification}</p>
        </MobileCard>
      )}
    />
  );
}