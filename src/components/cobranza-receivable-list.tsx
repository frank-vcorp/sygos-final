"use client";

import { ClientNameLink } from "@/components/client-entity-links";
import { FolioCell } from "@/components/folio-cell";
import { SortableResponsiveList } from "@/components/sortable-list";
import { Badge, MobileCard, RecordLink } from "@/components/ui";
import { formatWhen } from "@/lib/form";
import { receivableOverdueScore } from "@/lib/list-sort";
import { money } from "@/lib/money";

export type CobranzaReceivableRow = {
  id: string;
  documentFolio: string;
  diagnosisFolio: string | null;
  diagnosisHref: string | null;
  osFolio: string | null;
  osHref: string | null;
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  balance: number;
  dueAt: string | Date;
  status: string;
};

function statusLabel(row: CobranzaReceivableRow) {
  const overdue = row.balance > 0 && new Date(row.dueAt).getTime() < Date.now();
  return overdue ? "Vencida" : row.status === "SALDADA" ? "Saldada" : row.status === "PARCIAL" ? "Parcial" : "Abierta";
}

export function CobranzaReceivableList({
  rows,
  canEditClient,
}: {
  rows: CobranzaReceivableRow[];
  canEditClient: boolean;
}) {
  return (
    <SortableResponsiveList
      rows={rows}
      initialOrder={{ mode: "preserve" }}
      rowKey={(row) => row.id}
      columns={[
        {
          id: "documento",
          header: "Documento",
          value: (row) => row.documentFolio,
          cell: (row) => <RecordLink href={`/cobranza/${row.id}`}>{row.documentFolio}</RecordLink>,
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
          id: "cliente",
          header: "Cliente",
          value: (row) => row.clientName,
          cell: (row) => (
            <ClientNameLink clientId={row.clientId} name={row.clientName} isSystem={row.clientIsSystem} canEdit={canEditClient} />
          ),
        },
        {
          id: "saldo",
          header: "Saldo",
          value: (row) => row.balance,
          cell: (row) => money(row.balance),
        },
        {
          id: "vence",
          header: "Vence",
          value: (row) => row.dueAt,
          cell: (row) => formatWhen(new Date(row.dueAt)),
        },
        {
          id: "estado",
          header: "Estado",
          value: (row) => receivableOverdueScore(row.balance, row.dueAt),
          cell: (row) => {
            const overdue = row.balance > 0 && new Date(row.dueAt).getTime() < Date.now();
            return <Badge tone={overdue ? "warn" : "neutral"}>{statusLabel(row)}</Badge>;
          },
        },
      ]}
      mobileCard={(row) => {
        const overdue = row.balance > 0 && new Date(row.dueAt).getTime() < Date.now();
        return (
          <MobileCard
            href={`/cobranza/${row.id}`}
            title={row.documentFolio}
            meta={<Badge tone={overdue ? "warn" : "neutral"}>{statusLabel(row)}</Badge>}
            footer={
              <ClientNameLink
                clientId={row.clientId}
                name={row.clientName}
                isSystem={row.clientIsSystem}
                canEdit={canEditClient}
              />
            }
          >
            {row.diagnosisFolio ? <p>DX: {row.diagnosisFolio}</p> : null}
            {row.osFolio ? <p>OS: {row.osFolio}</p> : null}
            <p>
              {money(row.balance)} · vence {formatWhen(new Date(row.dueAt))}
            </p>
          </MobileCard>
        );
      }}
    />
  );
}