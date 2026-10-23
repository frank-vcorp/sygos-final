import type { StackedStatus } from "@/lib/servicios-bandeja";
import type { ServicioBandejaRow } from "@/lib/servicios-supervisor";

/** Cotizada con precio; el cliente aún no autoriza (edo. administrativo «Cotizado» sin «Autorizado»). */
export function quoteCotizadaSinAutorizacion(status: string) {
  return status === "PENDIENTE_DECISION";
}

/** Sin precio comercial: aún no puede enviarse a autorización del cliente. */
export function quotePendienteAutorizacion(status: string) {
  return status === "PENDIENTE_COTIZAR";
}

export function servicioCotizadaSinAutorizacion(row: ServicioBandejaRow) {
  const { administrative } = row;
  return administrative.label === "Cotizado" && !administrative.tags?.includes("Autorizado");
}

/** Aún sin precio / cotización comercial (bandeja «Sin cotizar»). */
export function servicioPendienteAutorizacion(row: ServicioBandejaRow) {
  return row.administrative.label === "Sin cotizar";
}

export function servicioOsValidadaSinFacturar(row: ServicioBandejaRow) {
  if (!row.osFolio) return false;
  return row.technical.label === "Validado";
}

export function servicioOsValidadaPendienteEntrega(row: ServicioBandejaRow) {
  if (!row.osFolio) return false;
  if (row.technical.label !== "Validado") return false;
  return row.physical.label !== "Entregado";
}

export function receivableEsVigente(dueAt: Date, balance: number, now = Date.now()) {
  return balance > 0 && dueAt.getTime() >= now;
}

export function formatAdministrativeDetail(administrative: StackedStatus) {
  const tags = administrative.tags?.length ? ` · ${administrative.tags.join(", ")}` : "";
  return `${administrative.label}${tags}`;
}
