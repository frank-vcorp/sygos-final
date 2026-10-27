import { listHref } from "./list-url";

export const requirementStatuses = ["PENDIENTE", "EN_LISTA", "ATENDIDO", "CANCELADO"] as const;

export type RequirementStatus = (typeof requirementStatuses)[number];

export type RequirementFilters = {
  estado?: RequirementStatus;
  solicitante?: string;
  fecha?: string;
};

export function requirementStatusFilter(value: string | undefined): RequirementStatus {
  return requirementStatuses.includes(value as RequirementStatus) ? (value as RequirementStatus) : "PENDIENTE";
}

/** URL canónica del listado para que los filtros se puedan compartir y recargar. */
export function requirementListHref(filters: RequirementFilters) {
  return listHref("/compras/requerimientos", {
    estado: filters.estado && filters.estado !== "PENDIENTE" ? filters.estado : undefined,
    solicitante: filters.solicitante?.trim() || undefined,
    fecha: filters.fecha || undefined,
  });
}
