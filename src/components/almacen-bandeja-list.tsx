"use client";

import { ClientNameLink } from "@/components/client-entity-links";
import { SortableResponsiveList } from "@/components/sortable-list";
import { MobileCard, RecordLink } from "@/components/ui";
import type { AlmacenBandejaRow } from "@/lib/almacen-bandeja";
import type { StatusTone, StackedStatus } from "@/lib/servicios-bandeja";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "border-[#d8dee6] bg-[#f4f6f8] text-[#3d4650]",
  ok: "border-[#b8dcc8] bg-[#e8f6ee] text-[#0d6b4d]",
  warn: "border-[#f0d4a8] bg-[#fff6e8] text-[#9a3412]",
  danger: "border-[#efcaca] bg-[#fef2f2] text-[#b42318]",
  info: "border-[#b8d4f0] bg-[#edf5fc] text-[#1d4f8c]",
};

function StatusBadge({ status }: { status: StackedStatus }) {
  return (
    <span
      className={`inline-flex max-w-full whitespace-nowrap rounded border px-1.5 py-px text-[10px] font-semibold leading-[1.15rem] ${TONE_CLASS[status.tone]}`}
    >
      {status.label}
    </span>
  );
}

function FolioCell({ folio, href }: { folio: string | null; href: string | null }) {
  if (!folio) return <span className="text-[var(--muted)]">—</span>;
  if (!href) return <span className="font-medium text-[var(--ink)]">{folio}</span>;
  return <RecordLink href={href}>{folio}</RecordLink>;
}

export function AlmacenBandejaList({ rows }: { rows: AlmacenBandejaRow[] }) {
  return (
    <SortableResponsiveList
      rows={rows}
      initialOrder={{ mode: "preserve" }}
      rowKey={(row) => row.equipmentId}
      stickyHeader
      columns={[
        {
          id: "diagnostico",
          header: "Diagnóstico",
          value: (row) => row.diagnosisFolio ?? "",
          cell: (row) => <FolioCell folio={row.diagnosisFolio} href={row.diagnosisHref} />,
        },
        {
          id: "os",
          header: "Orden de servicio",
          value: (row) => row.osFolio ?? "",
          cell: (row) => <FolioCell folio={row.osFolio} href={row.osHref} />,
        },
        {
          id: "equipo",
          header: "Equipo",
          value: (row) => row.equipmentLabel,
          cell: (row) => (
            <>
              <RecordLink href={row.equipmentHref}>{row.equipmentLabel}</RecordLink>
              {row.legacyFolio ? (
                <span className="block text-[10px] font-medium text-[var(--muted)]">Ant: {row.legacyFolio}</span>
              ) : null}
            </>
          ),
        },
        {
          id: "cliente",
          header: "Cliente",
          value: (row) => row.clientName,
          cell: (row) => (
            <ClientNameLink clientId={row.clientId} name={row.clientName} isSystem={row.clientIsSystem} />
          ),
        },
        {
          id: "fisico",
          header: "Edo. físico",
          value: (row) => row.physical.label,
          cell: (row) => <StatusBadge status={row.physical} />,
        },
        {
          id: "vendedor",
          header: "Vendedor",
          value: (row) => row.sellerName ?? "",
          cell: (row) => row.sellerName ?? "Sin asignar",
        },
      ]}
      mobileCard={(row) => (
        <MobileCard
          href={row.equipmentHref}
          title={row.osFolio ?? row.diagnosisFolio ?? row.equipmentLabel}
          meta={<StatusBadge status={row.physical} />}
        >
          {row.diagnosisFolio ? <p>DX: {row.diagnosisFolio}</p> : null}
          {row.osFolio ? <p>OS: {row.osFolio}</p> : null}
          <p>{row.equipmentLabel}</p>
          {row.legacyFolio ? <p>Folio anterior: {row.legacyFolio}</p> : null}
          <p>
            <ClientNameLink clientId={row.clientId} name={row.clientName} isSystem={row.clientIsSystem} />
          </p>
          <p>Vendedor: {row.sellerName ?? "Sin asignar"}</p>
        </MobileCard>
      )}
    />
  );
}