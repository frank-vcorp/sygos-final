import {
  ADMIN_ESTADO,
  ADMIN_SUBESTADO,
  administrativeStatus,
  equipmentDetailHref,
  formatEquipmentBandejaLabel,
  physicalEstadoEsEntregadoAlCliente,
  physicalStatusFromCustody,
  stackedHasTag,
  stackedWithoutSubestados,
  TECHNICAL_ESTADO,
} from "@/lib/servicios-bandeja";
import { linesForTotal, money, quoteTotals } from "@/lib/money";
import type { ServicioBandejaRow } from "@/lib/servicios-supervisor";

/** DX validado sin reparación (estado administrativo dedicado). */
export function servicioDxSinReparacion(row: ServicioBandejaRow) {
  return (
    row.administrative.label === ADMIN_ESTADO.DX_SIN_REPARACION
    && row.technical.label === TECHNICAL_ESTADO.VALIDADO
    && Boolean(row.diagnosisFolio)
  );
}

/** DX sin reparación con solicitud de factura/remisión aún no emitida (prioridad de cobro). */
export function servicioDxSinReparacionPendienteEmitir(row: ServicioBandejaRow, diagnosisFolios: ReadonlySet<string>) {
  if (!servicioDxSinReparacion(row)) return false;
  return row.diagnosisFolio != null && diagnosisFolios.has(row.diagnosisFolio);
}

/** Cotizado sin subestado distinto de la decisión comercial del vendedor (legacy / casos intermedios). */
export function servicioCotizadaSinAutorizacion(row: ServicioBandejaRow) {
  if (row.quoteStatus === "PENDIENTE_DECISION") return false;
  return row.administrative.label === ADMIN_ESTADO.COTIZADO && stackedWithoutSubestados(row.administrative);
}

/** Cotización comercial pendiente de autorizar (PENDIENTE_DECISION) o cotizado con subestado «No autorizado». */
export function servicioPendienteAutorizacion(row: ServicioBandejaRow) {
  if (row.quoteStatus === "PENDIENTE_DECISION") {
    return row.administrative.label === ADMIN_ESTADO.COTIZADO;
  }
  return (
    row.administrative.label === ADMIN_ESTADO.COTIZADO
    && stackedHasTag(row.administrative, ADMIN_SUBESTADO.NO_AUTORIZADO)
  );
}

/** OS con cierre técnico validado y autorización comercial. */
export function servicioOsValidadaAutorizada(row: ServicioBandejaRow) {
  if (!row.osFolio) return false;
  return (
    row.technical.label === TECHNICAL_ESTADO.VALIDADO
    && stackedHasTag(row.administrative, ADMIN_SUBESTADO.AUTORIZADO)
  );
}

export function servicioOsValidadaPendienteEntrega(row: ServicioBandejaRow) {
  if (!row.osFolio) return false;
  if (row.technical.label !== TECHNICAL_ESTADO.VALIDADO) return false;
  return !physicalEstadoEsEntregadoAlCliente(row.physical);
}

export function receivableEsVigente(dueAt: Date, balance: number, now = Date.now()) {
  return balance > 0 && dueAt.getTime() >= now;
}

/** Cartera comercial: cotización asignada al vendedor o cliente de su cartera. */
export function quoteVisibleToSeller(
  quote: { sellerUserId: string | null; clientOwnerUserId: string | null },
  sellerUserId: string,
) {
  if (quote.sellerUserId === sellerUserId) return true;
  if (quote.sellerUserId != null && quote.sellerUserId !== sellerUserId) return false;
  return quote.clientOwnerUserId === sellerUserId;
}

export function servicioPendienteAutorizacionForSeller(row: ServicioBandejaRow, sellerUserId: string) {
  if (!servicioPendienteAutorizacion(row)) return false;
  if (row.quoteStatus === "PENDIENTE_DECISION" && row.quoteSellerUserId != null && row.quoteSellerUserId !== sellerUserId) {
    return false;
  }
  return true;
}

type PendingQuotePanelInput = {
  id: string;
  folio: string;
  quoteType: string;
  status: string;
  discountPct: number;
  sellerUserId: string | null;
  client: { id: string; name: string; isSystem: boolean; ownerUserId: string | null };
  equipment: {
    id: string;
    kind: string;
    folio: string;
    custody: string;
    typeName: string | null;
    brandName: string | null;
    model: string;
    client: { id: string; name: string; isSystem: boolean };
  } | null;
  lines: Array<{ quantity: number; unitPrice: number | null; authorized: boolean }>;
};

/** Cotización PENDIENTE_DECISION sin fila en servicios activos (p. ej. COTDX previa a operación). */
export function servicioRowFromPendingQuote(quote: PendingQuotePanelInput): ServicioBandejaRow {
  const equipment = quote.equipment;
  const client = equipment?.client ?? quote.client;
  const totals = quoteTotals(linesForTotal(quote.lines, quote.quoteType, quote.status), quote.discountPct);
  const quoteMonto = totals ? money(totals.total) : "—";
  const administrative = administrativeStatus({
    attentionType: quote.quoteType === "REPARACION" ? "REPARACION" : "DIAGNOSTICO",
    quoteStatus: "PENDIENTE_DECISION",
    quotePending: false,
    warrantyDecision: null,
  });
  return {
    kind: "servicio",
    id: `quote-${quote.id}`,
    equipmentId: equipment?.id ?? quote.client.id,
    equipmentHref: equipment ? equipmentDetailHref(equipment.kind, equipment.id) : `/clientes/${quote.client.id}`,
    equipmentLabel: equipment ? formatEquipmentBandejaLabel(equipment) : quote.client.name,
    diagnosisFolio: null,
    diagnosisHref: null,
    osFolio: null,
    osHref: null,
    clientId: client.id,
    clientName: client.name,
    clientIsSystem: client.isSystem,
    technical: { label: "—", tone: "neutral" },
    administrative,
    physical: equipment ? physicalStatusFromCustody(equipment.custody) : { label: "—", tone: "neutral" },
    sellerName: null,
    technicianName: null,
    quoteFolio: quote.folio,
    quoteHref: `/cotizaciones/${quote.id}`,
    quoteStatus: "PENDIENTE_DECISION",
    quoteSellerUserId: quote.sellerUserId,
    quoteMonto,
    slaDueAt: null,
    slaStartedAt: null,
    attentionCreatedAt: new Date(),
    priorityName: "—",
    attentionType: quote.quoteType === "REPARACION" ? "REPARACION" : "DIAGNOSTICO",
    createdAt: new Date(),
    closedAt: null,
    primaryStatus: "PENDIENTE_DECISION",
  };
}

export function mergeSalesPendientesAutorizacion(
  servicioRows: ServicioBandejaRow[],
  orphanQuoteRows: ServicioBandejaRow[],
  sellerUserId: string,
) {
  const seen = new Set<string>();
  const merged: ServicioBandejaRow[] = [];
  for (const row of [...servicioRows, ...orphanQuoteRows]) {
    if (!servicioPendienteAutorizacionForSeller(row, sellerUserId)) continue;
    const key = row.quoteHref ?? row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}
