import { MobileCard, RecordLink, ResponsiveData, Table, Td, Th } from "@/components/ui";
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
    <ResponsiveData
      table={
        <Table stickyHeader>
          <thead>
            <tr>
              <Th>Diagnóstico</Th>
              <Th>Orden de servicio</Th>
              <Th>Equipo</Th>
              <Th>Cliente</Th>
              <Th>Edo. físico</Th>
              <Th>Vendedor</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.equipmentId}>
                <Td><FolioCell folio={row.diagnosisFolio} href={row.diagnosisHref} /></Td>
                <Td><FolioCell folio={row.osFolio} href={row.osHref} /></Td>
                <Td>
                  <RecordLink href={row.equipmentHref}>{row.equipmentLabel}</RecordLink>
                </Td>
                <Td>{row.clientName}</Td>
                <Td><StatusBadge status={row.physical} /></Td>
                <Td>{row.sellerName ?? "Sin asignar"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      }
      cards={rows.map((row) => (
        <MobileCard
          key={row.equipmentId}
          href={row.equipmentHref}
          title={row.osFolio ?? row.diagnosisFolio ?? row.equipmentLabel}
          meta={<StatusBadge status={row.physical} />}
        >
          {row.diagnosisFolio ? <p>DX: {row.diagnosisFolio}</p> : null}
          {row.osFolio ? <p>OS: {row.osFolio}</p> : null}
          <p>{row.equipmentLabel}</p>
          <p>{row.clientName}</p>
          <p>Vendedor: {row.sellerName ?? "Sin asignar"}</p>
        </MobileCard>
      ))}
    />
  );
}
