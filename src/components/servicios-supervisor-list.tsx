"use client";

import { ClientNameLink } from "@/components/client-entity-links";
import { SortableResponsiveList } from "@/components/sortable-list";
import { SlaCountdown } from "@/components/sla-countdown";
import { MobileCard, RecordLink } from "@/components/ui";
import { bandejaColumnSortValue } from "@/lib/servicios-bandeja-sort";
import {
  activeTechnicalCaseFolio,
  formatServiciosBandejaDate,
  orderedBandejaDisplayColumns,
  priorityNameTone,
  serviciosBandejaColumns,
  type ServicioBandejaColumnKey,
  type ServicioBandejaColumnOptions,
  type ServicioBandejaColumns,
  type ServicioBandejaDisplayColumnKey,
  type StatusTone,
  type StackedStatus,
} from "@/lib/servicios-bandeja";
import type { Role } from "@/lib/roles";
import { isReparacionExpressAttentionType } from "@/lib/priorities";
import { servicioRowHighlight, type SupervisorServicioRow } from "@/lib/servicios-supervisor-rows";

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

function AtencionVigenteCell({
  createdAt,
  priorityName,
  legacyFolio,
}: {
  createdAt: Date;
  priorityName: string;
  legacyFolio?: string | null;
}) {
  const tone = priorityNameTone(priorityName);
  return (
    <div className="flex min-w-0 flex-col items-start gap-px leading-none">
      <span className="whitespace-nowrap text-[13px] font-medium text-[var(--ink)]">
        {formatServiciosBandejaDate(createdAt)}
      </span>
      <span className={`max-w-full truncate text-[10px] font-semibold leading-[1.1rem] ${TAG_TEXT_CLASS[tone]}`} title={priorityName}>
        {priorityName}
      </span>
      {legacyFolio ? (
        <span className="max-w-full truncate text-[10px] font-medium leading-[1.1rem] text-[var(--muted)]" title={`Folio anterior: ${legacyFolio}`}>
          Ant: {legacyFolio}
        </span>
      ) : null}
    </div>
  );
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

function ActiveServicioCell({ row }: { row: ServicioBandejaRowLike }) {
  const active = activeTechnicalCaseFolio(row);
  if (!active) return null;
  if (!active.href) return <span className="font-medium text-[var(--ink)]">{active.folio}</span>;
  return <RecordLink href={active.href}>{active.folio}</RecordLink>;
}

type ServicioBandejaRowLike = {
  osFolio: string | null;
  osHref: string | null;
  diagnosisFolio: string | null;
  diagnosisHref: string | null;
};

function formatClosedAt(date: Date) {
  return date.toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const SLA_BANDEJA_CLASS = "text-[11px] leading-4 whitespace-nowrap";

function SlaCell({
  dueAt,
  historial,
  closedAt,
  attentionType,
}: {
  dueAt: Date | null;
  historial: boolean;
  closedAt: Date | null;
  attentionType?: string;
}) {
  const express = attentionType ? isReparacionExpressAttentionType(attentionType) : false;
  if (historial) {
    return (
      <span className={`text-xs text-[var(--muted)] ${SLA_BANDEJA_CLASS}`}>
        {closedAt ? formatClosedAt(closedAt) : "—"}
      </span>
    );
  }
  return (
    <div className="inline-block w-max max-w-none rounded border border-[var(--line)] bg-[#f8fafc] px-1.5 py-0.5">
      <SlaCountdown dueAt={dueAt} className={SLA_BANDEJA_CLASS} express={express} />
    </div>
  );
}

const VIGENTE_ROW_CLASS = "bg-gradient-to-r from-[#f0fdf4] to-white ring-1 ring-inset ring-[#86efac]/70";

function rowSurfaceClass(wrapClass: string, extra?: string, historial?: boolean) {
  const parts = [historial ? "" : wrapClass, extra].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

function bandejaThLabel(key: ServicioBandejaDisplayColumnKey, trailHeader: string) {
  if (key === "servicioActivo") return "Servicio activo";
  const labels: Record<ServicioBandejaColumnKey, string> = {
    atencionVigente: "Atención",
    diagnostico: "Diagnóstico",
    ordenServicio: "Orden de servicio",
    equipo: "Equipo",
    cliente: "Cliente",
    edoTecnico: "Edo. técnico",
    edoAdministrativo: "Edo. administrativo",
    cotizacion: "Cotización",
    cotizacionMonto: "Monto",
    vendedor: "Vendedor",
    tecnico: "Técnico",
    sla: trailHeader,
  };
  return labels[key as ServicioBandejaColumnKey];
}

function columnEnabled(columns: ServicioBandejaColumns, columnKey: ServicioBandejaDisplayColumnKey) {
  if (columnKey === "servicioActivo") return columns.diagnostico || columns.ordenServicio;
  return columns[columnKey];
}

function BandejaCell({
  columnKey,
  row,
  columns,
  historial,
}: {
  columnKey: ServicioBandejaDisplayColumnKey;
  row: SupervisorServicioRow;
  columns: ServicioBandejaColumns;
  historial: boolean;
}) {
  if (!columnEnabled(columns, columnKey)) return null;

  if (row.kind === "cancelado") {
    switch (columnKey) {
      case "atencionVigente":
        return (
          <AtencionVigenteCell createdAt={row.createdAt} priorityName={row.priorityName} legacyFolio={row.legacyFolio} />
        );
      case "servicioActivo":
        return null;
      case "diagnostico":
      case "ordenServicio":
      case "vendedor":
      case "tecnico":
      case "cotizacion":
      case "cotizacionMonto":
        return <span className="text-[var(--muted)]">—</span>;
      case "equipo":
        return (
          <RecordLink href={row.equipmentHref}>{row.equipmentLabel}</RecordLink>
        );
      case "cliente":
        return (
          <ClienteCell clientId={row.clientId} clientName={row.clientName} clientIsSystem={row.clientIsSystem} />
        );
      case "edoTecnico":
        return (
          <StatusBadge status={{ label: "Cancelada", tone: "danger" }} />
        );
      case "edoAdministrativo":
        return columns.edoTecnico ? (
          <span className="text-[var(--muted)]">—</span>
        ) : (
          <StatusBadge status={{ label: "Cancelada", tone: "danger" }} />
        );
      case "sla":
        return <span className="text-sm text-[var(--muted)]">{formatClosedAt(row.closedAt)}</span>;
      default:
        return null;
    }
  }

  switch (columnKey) {
    case "atencionVigente":
      return (
        <AtencionVigenteCell createdAt={row.attentionCreatedAt} priorityName={row.priorityName} legacyFolio={row.legacyFolio} />
      );
    case "servicioActivo":
      return <ActiveServicioCell row={row} />;
    case "diagnostico":
      return <FolioCell folio={row.diagnosisFolio} href={row.diagnosisHref} />;
    case "ordenServicio":
      return <FolioCell folio={row.osFolio} href={row.osHref} />;
    case "equipo":
      return (
        <RecordLink href={row.equipmentHref}>{row.equipmentLabel}</RecordLink>
      );
    case "cliente":
      return (
        <ClienteCell clientId={row.clientId} clientName={row.clientName} clientIsSystem={row.clientIsSystem} />
      );
    case "edoTecnico":
      return <StatusBadge status={row.technical} />;
    case "edoAdministrativo":
      return <StatusBadge status={row.administrative} />;
    case "vendedor":
      return row.sellerName ?? "Sin asignar";
    case "tecnico":
      return row.technicianName ?? "Sin asignar";
    case "sla":
      return (
        <SlaCell dueAt={row.slaDueAt} historial={historial} closedAt={row.closedAt} attentionType={row.attentionType} />
      );
    case "cotizacion":
      return (
        <FolioCell folio={row.quoteFolio} href={row.quoteHref} />
      );
    case "cotizacionMonto":
      return row.quoteMonto;
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
  const activos = variant === "activos";
  const columns = serviciosBandejaColumns(role, columnOptions);
  const columnOrder = orderedBandejaDisplayColumns(columns, columnOptions, historial ? "historial" : "activos");
  const trailHeader = historial ? "Cierre" : "SLA";

  const sortableColumns = columnOrder.map((key) => ({
    id: key,
    header: bandejaThLabel(key, trailHeader),
    sortable: true,
    value: (row: SupervisorServicioRow) => bandejaColumnSortValue(row, key, historial),
    cell: (row: SupervisorServicioRow) => (
      <BandejaCell columnKey={key} row={row} columns={columns} historial={historial} />
    ),
  }));

  return (
    <SortableResponsiveList
      rows={rows}
      columns={sortableColumns}
      stickyHeader
      initialOrder={{ mode: "preserve" }}
      rowKey={(row) => (row.kind === "cancelado" ? `att-${row.id}` : row.id)}
      rowClassName={(row) => {
        const { wrapClass } = servicioRowHighlight(row);
        const extraClass = highlightRow?.(row) ? VIGENTE_ROW_CLASS : undefined;
        return rowSurfaceClass(wrapClass, extraClass, historial);
      }}
      mobileCard={(row) => {
        const { wrapClass } = servicioRowHighlight(row);
        const extraClass = highlightRow?.(row) ? VIGENTE_ROW_CLASS : undefined;
        if (row.kind === "cancelado") {
          return (
            <div key={`att-${row.id}`}>
              <MobileCard href={row.equipmentHref} title="Atención cancelada" meta={<StatusBadge status={{ label: "Cancelada", tone: "danger" }} />}>
                <p>{row.equipmentLabel}</p>
                <p><ClienteCell clientId={row.clientId} clientName={row.clientName} clientIsSystem={row.clientIsSystem} /></p>
                <p>
                  {formatServiciosBandejaDate(row.createdAt)} ·{" "}
                  <span className={TAG_TEXT_CLASS[priorityNameTone(row.priorityName)]}>{row.priorityName}</span>
                </p>
                {row.legacyFolio ? <p>Folio anterior: {row.legacyFolio}</p> : null}
                <p>Cierre: {formatClosedAt(row.closedAt)}</p>
              </MobileCard>
            </div>
          );
        }

        const activeCase = activos ? activeTechnicalCaseFolio(row) : null;
        const title = activos
          ? activeCase?.folio ?? row.equipmentLabel
          : row.osFolio ?? row.diagnosisFolio ?? row.equipmentLabel;
        const href = activos
          ? activeCase?.href ?? row.equipmentHref
          : row.osHref ?? row.diagnosisHref ?? row.equipmentHref;
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
              {activos && activeCase ? (
                <p>
                  Servicio activo:{" "}
                  {activeCase.href ? <RecordLink href={activeCase.href}>{activeCase.folio}</RecordLink> : activeCase.folio}
                </p>
              ) : null}
              {!activos && columns.diagnostico && row.diagnosisFolio ? <p>DX: {row.diagnosisFolio}</p> : null}
              {!activos && columns.ordenServicio && row.osFolio ? <p>OS: {row.osFolio}</p> : null}
              <p>{row.equipmentLabel}</p>
              <p><ClienteCell clientId={row.clientId} clientName={row.clientName} clientIsSystem={row.clientIsSystem} /></p>
              {columns.atencionVigente ? (
                <p>
                  {formatServiciosBandejaDate(row.attentionCreatedAt)} ·{" "}
                  <span className={TAG_TEXT_CLASS[priorityNameTone(row.priorityName)]}>{row.priorityName}</span>
                </p>
              ) : null}
              {row.legacyFolio ? <p>Folio anterior: {row.legacyFolio}</p> : null}
              {columns.vendedor ? <p>Vendedor: {row.sellerName ?? "Sin asignar"}</p> : null}
              {columns.tecnico ? <p>Técnico: {row.technicianName ?? "Sin asignar"}</p> : null}
              {columns.sla ? (
                <p>
                  {historial ? (
                    <>Cierre: {row.closedAt ? formatClosedAt(row.closedAt) : "—"}</>
                  ) : (
                    <>
                      SLA:{" "}
                      <SlaCountdown
                        dueAt={row.slaDueAt}
                        express={isReparacionExpressAttentionType(row.attentionType)}
                      />
                    </>
                  )}
                </p>
              ) : null}
              {!quoteFirst ? quoteLine : null}
            </MobileCard>
          </div>
        );
      }}
    />
  );
}
