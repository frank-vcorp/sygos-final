import {
  ADMIN_ESTADO,
  ADMIN_SUBESTADO,
  PHYSICAL_ESTADO,
  stackedHasTag,
  stackedWithoutSubestados,
  TECHNICAL_ESTADO,
} from "@/lib/servicios-bandeja";
import type { ServicioBandejaRow } from "@/lib/servicios-supervisor";

/** Cotizado sin subestado: precio definido, sin autorización del cliente aún. */
export function servicioCotizadaSinAutorizacion(row: ServicioBandejaRow) {
  return row.administrative.label === ADMIN_ESTADO.COTIZADO && stackedWithoutSubestados(row.administrative);
}

/** Cotizado con subestado «No autorizado» (decisión registrada). */
export function servicioPendienteAutorizacion(row: ServicioBandejaRow) {
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
  return row.physical.label !== PHYSICAL_ESTADO.ENTREGADO;
}

export function receivableEsVigente(dueAt: Date, balance: number, now = Date.now()) {
  return balance > 0 && dueAt.getTime() >= now;
}
