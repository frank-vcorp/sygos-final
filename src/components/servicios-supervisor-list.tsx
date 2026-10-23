import { ClientNameLink } from "@/components/client-entity-links";
import { SlaCountdown } from "@/components/sla-countdown";
import { MobileCard, RecordLink, ResponsiveData, Table, Td, Th } from "@/components/ui";
import {
  orderedBandejaColumns,
  serviciosBandejaColumns,
  type ServicioBandejaColumnKey,
  type ServicioBandejaColumnOptions,
  type ServicioBandejaColumns,
  type StatusTone,
  type StackedStatus,
} from "@/lib/servicios-bandeja";
import type { Role } from "@/lib/roles";
import { servicioRowHighlight, type SupervisorServicioRow } from "@/lib/servicios-supervisor";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "border-[#d8dee6] bg-[#f4f6f8] text-[#3d4650]",
  ok: "border-[#b8dcc8] bg-[#e8f6ee] text-[#0d6b4d]",
  warn: "border-[#f0d4a8] bg-[#fff6e8] text-[#9a3412]",
  danger: "border-[#efcaca] bg-[#fef2f2] text-[#b42318]",
  info: "border-[#b8d4f0] bg-[#edf5fc] text-[#1d4f8c]",
};

const TAG_TEXT_CLASS: Record<StatusTone, string> = {
  neutral: "text-[#5c6670]",
  ok: "text-[#0a7a55]",
  warn: "text-[#b45309]",
  danger: "text-[#c81e1e]",
  info: "text-[#1d5f9a]",
};

function tagTone(tag: string): StatusTone {
  if (tag === "No autorizado") return "danger";
  if (tag === "Autorizado") return "ok";
  if (tag.toLowerCase().includes("refacciones")) return "info";
  return "neutral";
}

function StatusBadge({ status }: { status: StackedStatus }) {
  return (
    <div className="flex min-w-0 max-w-[9.5rem] flex-col items-start gap-px leading-none">
      <span
        className={`inline-flex max-w-full whitespace-nowrap rounded border px-1.5 py-px text-[10px] font-semibold leading-[1.15rem] ${TONE_CLASS[status.tone]}`}
      >
        {status.label}
      </span>
      {status.tags?.map((tag) => (
        <span
          key={tag}
          className={`max-w-full truncate text-[10px] font-semibold leading-[1.1rem] ${TAG_TEXT_CLASS[tagTone(tag)]}`}
          title={tag}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function ClienteCell(row: { clientId: string; clientName: string; clientIsSystem: boolean }) {
  return (
    <ClientNameLink
      clientId={row.clientId}
      name={row.clientName}
      isSystem={row.clientIsSystem}
    />
  );
}

function FolioCell({ folio, href }: { folio: string | null; href: string | null }) {
  if (!folio) return <span className="text-[var(--muted)]">—</span>;
  if (!href) return <span className="font-medium text-[var(--ink)]">{folio}</span>;
  return <RecordLink href={href}>{folio}</RecordLink>;
}

function formatClosedAt(date: Date) {
  return date.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const SLA_BANDEJA_CLASS = "text-[11px] leading-4 whitespace-nowrap";

function SlaCell({ dueAt, historial, closedAt }: { dueAt: Date | null; historial: boolean; closedAt: Date | null }) {
  if (historial) {
    return (
      <span className={`text-xs text-[var(--muted)] ${SLA_BANDEJA_CLASS}`}>
        {closedAt ? formatClosedAt(closedAt) : "—"}
      </span>
    );
  }
  return (
    <div className="inline-block w-max max-w-none rounded border border-[var(--line)] bg-[#f8fafc] px-1.5 py-0.5">
      <SlaCountdown dueAt={dueAt} className={SLA_BANDEJA_CLASS} />
    </div>
  );
}

const VIGENTE_ROW_CLASS = "bg-gradient-to-r from-[#f0fdf4] to-white ring-1 ring-inset ring-[#86efac]/70";

function rowSurfaceClass(wrapClass: string, extra?: string, historial?: boolean) {
  const parts = [historial ? "" : wrapClass, extra].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

function bandejaThLabel(key: ServicioBandejaColumnKey, trailHeader: string) {
  const labels: Record<ServicioBandejaColumnKey, string> = {
    diagnostico: "Diagnóstico",
    ordenServicio: "Orden de servicio",
    equipo: "Equipo",
    cliente: "Cliente",
    edoTecnico: "Edo. técnico",
    edoAdministrativo: "Edo. administrativo",
    edoFisico: "Edo. físico",
    cotizacion: "Cotización",
    cotizacionMonto: "Monto",
    vendedor: "Vendedor",
    tecnico: "Técnico",
    sla: trailHeader,
  };
  return labels[key];
}

function BandejaTd({
  columnKey,
  row,
  columns,
  historial,
}: {
  columnKey: ServicioBandejaColumnKey;
  row: SupervisorServicioRow;
  columns: ServicioBandejaColumns;
  historial: boolean;
}) {
  if (!columns[columnKey]) return null;

  if (row.kind === "cancelado") {
    switch (columnKey) {
      case "diagnostico":
      case "ordenServicio":
      case "edoFisico":
      case "vendedor":
      case "tecnico":
      case "cotizacion":
      case "cotizacionMonto":
        return <Td><span className="text-[var(--muted)]">—</span></Td>;
      case "equipo":
        return (
          <Td>
            <RecordLink href={row.equipmentHref}>{row.equipmentLabel}</RecordLink>
          </Td>
        );
      case "cliente":
        return (
          <Td>
            <ClienteCell clientId={row.clientId} clientName={row.clientName} clientIsSystem={row.clientIsSystem} />
          </Td>
        );
      case "edoTecnico":
        return (
          <Td>
            <StatusBadge status={{ label: "Cancelada", tone: "danger" }} />
          </Td>
        );
      case "edoAdministrativo":
        return (
          <Td>
            {columns.edoTecnico ? <span className="text-[var(--muted)]">—</span> : <StatusBadge status={{ label: "Cancelada", tone: "danger" }} />}
          </Td>
        );
      case "sla":
        return <Td><span className="text-sm text-[var(--muted)]">{formatClosedAt(row.closedAt)}</span></Td>;
      default:
        return null;
    }
  }

  switch (columnKey) {
    case "diagnostico":
      return <Td><FolioCell folio={row.diagnosisFolio} href={row.diagnosisHref} /></Td>;
    case "ordenServicio":
      return <Td><FolioCell folio={row.osFolio} href={row.osHref} /></Td>;
    case "equipo":
      return (
        <Td>
          <RecordLink href={row.equipmentHref}>{row.equipmentLabel}</RecordLink>
        </Td>
      );
    case "cliente":
      return (
        <Td>
          <ClienteCell clientId={row.clientId} clientName={row.clientName} clientIsSystem={row.clientIsSystem} />
        </Td>
      );
    case "edoTecnico":
      return <Td><StatusBadge status={row.technical} /></Td>;
    case "edoAdministrativo":
      return <Td><StatusBadge status={row.administrative} /></Td>;
    case "edoFisico":
      return <Td><StatusBadge status={row.physical} /></Td>;
    case "vendedor":
      return <Td>{row.sellerName ?? "Sin asignar"}</Td>;
    case "tecnico":
      return <Td>{row.technicianName ?? "Sin asignar"}</Td>;
    case "sla":
      return (
        <Td>
          <SlaCell dueAt={row.slaDueAt} historial={historial} closedAt={row.closedAt} />
        </Td>
      );
    case "cotizacion":
      return (
        <Td>
          <FolioCell folio={row.quoteFolio} href={row.quoteHref} />
        </Td>
      );
    case "cotizacionMonto":
      return <Td>{row.quoteMonto}</Td>;
    default:
      return null;
  }
}

export function ServiciosSupervisorList({
  rows,
  role,
  variant = "activos",
  highlightRow,
  columnOptions,
}: {
  rows: SupervisorServicioRow[];
  role: Role;
  variant?: "activos" | "historial";
  /** Resalta filas (p. ej. CxC vigente en panel de ventas). */
  highlightRow?: (row: SupervisorServicioRow) => boolean;
  columnOptions?: ServicioBandejaColumnOptions;
}) {
  const historial = variant === "historial";
  const columns = serviciosBandejaColumns(role, columnOptions);
  const columnOrder = orderedBandejaColumns(columns, columnOptions);
  const trailHeader = historial ? "Cierre" : "SLA";

  return (
    <ResponsiveData
      table={
        <Table stickyHeader>
          <thead>
            <tr>
              {columnOrder.map((key) => (
                <Th key={key}>{bandejaThLabel(key, trailHeader)}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { wrapClass } = servicioRowHighlight(row);
              const extraClass = highlightRow?.(row) ? VIGENTE_ROW_CLASS : undefined;
              const rowKey = row.kind === "cancelado" ? `att-${row.id}` : row.id;
              return (
                <tr key={rowKey} className={rowSurfaceClass(wrapClass, extraClass, historial)}>
                  {columnOrder.map((key) => (
                    <BandejaTd key={key} columnKey={key} row={row} columns={columns} historial={historial} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </Table>
      }
      cards={rows.map((row) => {
        const { wrapClass } = servicioRowHighlight(row);
        const extraClass = highlightRow?.(row) ? VIGENTE_ROW_CLASS : undefined;
        if (row.kind === "cancelado") {
          return (
            <div key={`att-${row.id}`}>
              <MobileCard href={row.equipmentHref} title="Atención cancelada" meta={<StatusBadge status={{ label: "Cancelada", tone: "danger" }} />}>
                <p>{row.equipmentLabel}</p>
                <p><ClienteCell clientId={row.clientId} clientName={row.clientName} clientIsSystem={row.clientIsSystem} /></p>
                <p>Cierre: {formatClosedAt(row.closedAt)}</p>
              </MobileCard>
            </div>
          );
        }

        const title = row.osFolio ?? row.diagnosisFolio ?? row.equipmentLabel;
        const href = row.osHref ?? row.diagnosisHref ?? row.equipmentHref;
        const quoteLine = columns.cotizacion ? (
          <p>
            Cotización:{" "}
            {row.quoteFolio ? (
              row.quoteHref ? <RecordLink href={row.quoteHref}>{row.quoteFolio}</RecordLink> : row.quoteFolio
            ) : (
              "—"
            )}
            {columns.cotizacionMonto ? ` · ${row.quoteMonto}` : null}
          </p>
        ) : null;
        const quoteFirst = Boolean(columnOptions?.cotizacionFirst);
        return (
          <div
            key={row.id}
            className={
              historial
                ? extraClass ? `rounded-xl p-0.5 ${extraClass}` : undefined
                : [wrapClass ? `rounded-xl p-0.5 ${wrapClass}` : "rounded-xl p-0.5", extraClass].filter(Boolean).join(" ") || undefined
            }
          >
            <MobileCard
              href={href}
              title={title}
              meta={
                <>
                  {columns.edoTecnico ? <StatusBadge status={row.technical} /> : null}
                  {columns.edoAdministrativo ? <StatusBadge status={row.administrative} /> : null}
                </>
              }
            >
              {quoteFirst ? quoteLine : null}
              {columns.diagnostico && row.diagnosisFolio ? <p>DX: {row.diagnosisFolio}</p> : null}
              {columns.ordenServicio && row.osFolio ? <p>OS: {row.osFolio}</p> : null}
              <p>{row.equipmentLabel}</p>
              <p><ClienteCell clientId={row.clientId} clientName={row.clientName} clientIsSystem={row.clientIsSystem} /></p>
              {columns.edoFisico ? <p>Físico: {row.physical.label}</p> : null}
              {columns.vendedor ? <p>Vendedor: {row.sellerName ?? "Sin asignar"}</p> : null}
              {columns.tecnico ? <p>Técnico: {row.technicianName ?? "Sin asignar"}</p> : null}
              {columns.sla ? (
                <p>
                  {historial ? (
                    <>Cierre: {row.closedAt ? formatClosedAt(row.closedAt) : "—"}</>
                  ) : (
                    <>
                      SLA: <SlaCountdown dueAt={row.slaDueAt} />
                    </>
                  )}
                </p>
              ) : null}
              {!quoteFirst ? quoteLine : null}
            </MobileCard>
          </div>
        );
      })}
    />
  );
}
