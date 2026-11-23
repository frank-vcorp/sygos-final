"use client";

import { SlaCountdown } from "@/components/sla-countdown";
import { SortableResponsiveList } from "@/components/sortable-list";
import { Badge, MobileCard, RecordLink } from "@/components/ui";
import { CASE_STATUS_LABEL } from "@/lib/case-labels";

export type OperacionQueueRow = {
  id: string;
  folio: string;
  equipmentFolio: string;
  equipmentModel: string;
  status: string;
  priorityName: string;
  assigneeName: string | null;
  externalSupplierId: string | null;
  slaDueAt: string | Date | null;
  express: boolean;
  readOnly: boolean;
  createdAt: string | Date;
};

function overdue(row: OperacionQueueRow) {
  const due = row.slaDueAt ? new Date(row.slaDueAt).getTime() : null;
  return !row.express && due != null && due < Date.now();
}

export function OperacionQueueList({ rows }: { rows: OperacionQueueRow[] }) {
  return (
    <SortableResponsiveList
      rows={rows}
      initialOrder={{ mode: "preserve" }}
      rowKey={(row) => row.id}
      columns={[
        {
          id: "folio",
          header: "Folio",
          value: (row) => row.folio,
          cell: (row) => (
            <>
              <RecordLink href={`/operacion/${row.id}`}>{row.folio}</RecordLink>
              {row.readOnly ? " · lectura" : ""}
            </>
          ),
        },
        {
          id: "equipo",
          header: "Equipo",
          value: (row) => `${row.equipmentFolio} ${row.equipmentModel}`,
          cell: (row) => (
            <span>
              {row.equipmentFolio} · {row.equipmentModel}
            </span>
          ),
        },
        {
          id: "estado",
          header: "Estado",
          value: (row) => CASE_STATUS_LABEL[row.status] ?? row.status,
          cell: (row) => (
            <Badge tone={overdue(row) ? "warn" : "neutral"}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>
          ),
        },
        {
          id: "prioridad",
          header: "Prioridad",
          value: (row) => row.priorityName,
          cell: (row) => row.priorityName,
        },
        {
          id: "responsable",
          header: "Responsable",
          value: (row) => (row.externalSupplierId ? "Servicio externo" : row.assigneeName ?? "Sin asignar"),
          cell: (row) => (row.externalSupplierId ? "Servicio externo" : row.assigneeName ?? "Sin asignar"),
        },
        {
          id: "sla",
          header: "SLA",
          value: (row) => row.slaDueAt ?? row.createdAt,
          cell: (row) => <SlaCountdown dueAt={row.slaDueAt ? new Date(row.slaDueAt) : null} express={row.express} />,
        },
      ]}
      mobileCard={(row) => (
        <MobileCard
          key={row.id}
          href={`/operacion/${row.id}`}
          title={`${row.folio}${row.readOnly ? " · lectura" : ""}`}
          meta={<Badge tone={overdue(row) ? "warn" : "neutral"}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>}
        >
          <p>
            {row.equipmentFolio} · {row.equipmentModel}
          </p>
          <p>
            {row.priorityName} · {row.externalSupplierId ? "Servicio externo" : row.assigneeName ?? "Sin asignar"}
          </p>
          <p>
            SLA: <SlaCountdown dueAt={row.slaDueAt ? new Date(row.slaDueAt) : null} express={row.express} />
          </p>
        </MobileCard>
      )}
    />
  );
}