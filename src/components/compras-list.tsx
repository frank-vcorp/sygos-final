"use client";

import { SortableResponsiveList } from "@/components/sortable-list";
import { Badge, MobileCard, RecordLink } from "@/components/ui";
import { money } from "@/lib/money";

const STATUS: Record<string, string> = {
  PENDIENTE_VALIDAR: "Pendiente de validar",
  PENDIENTE_AUTORIZACION: "Pendiente de autorización",
  AUTORIZADA: "Autorizada",
  RECHAZADA: "Rechazada",
  PROCESADA: "Procesada",
  CANCELADA: "Cancelada",
  ELIMINADA: "Eliminada",
};

export type CompraListRow = {
  id: string;
  folio: string;
  supplierName: string;
  category: string;
  requesterName: string;
  amount: number;
  status: string;
  createdAt: string | Date;
};

export function ComprasList({ rows, amountHeader }: { rows: CompraListRow[]; amountHeader: string }) {
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
          cell: (row) => <RecordLink href={`/compras/${row.id}`}>{row.folio}</RecordLink>,
        },
        {
          id: "proveedor",
          header: "Proveedor",
          value: (row) => row.supplierName,
          cell: (row) => row.supplierName,
        },
        {
          id: "categoria",
          header: "Categoría",
          value: (row) => row.category,
          cell: (row) => row.category,
        },
        {
          id: "solicitante",
          header: "Solicitante",
          value: (row) => row.requesterName,
          cell: (row) => row.requesterName,
        },
        {
          id: "importe",
          header: amountHeader,
          value: (row) => row.amount,
          cell: (row) => money(row.amount),
        },
        {
          id: "estado",
          header: "Estado",
          value: (row) => STATUS[row.status] ?? row.status,
          cell: (row) => <Badge>{STATUS[row.status] ?? row.status}</Badge>,
        },
        {
          id: "createdAt",
          header: "Fecha",
          value: (row) => row.createdAt,
          cell: (row) => (
            <span className="text-xs text-[var(--muted)]">
              {new Date(row.createdAt).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" })}
            </span>
          ),
        },
      ]}
      mobileCard={(row) => (
        <MobileCard key={row.id} href={`/compras/${row.id}`} title={row.folio} meta={<Badge>{STATUS[row.status] ?? row.status}</Badge>}>
          <p>{row.supplierName}</p>
          <p>{row.category || "Sin categoría"}</p>
          <p className="mt-1 font-medium">{money(row.amount)}</p>
        </MobileCard>
      )}
    />
  );
}