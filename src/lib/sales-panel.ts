import {
  ADMIN_ESTADO,
  ADMIN_SUBESTADO,
  physicalEstadoEsEntregadoAlCliente,
  stackedHasTag,
  stackedWithoutSubestados,
  TECHNICAL_ESTADO,
} from "@/lib/servicios-bandeja";
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
