import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

/** Resumen comercial en /inicio (clientes, prospectos, proveedores, pendientes de entrada). */
export function canSeeHomeSummary(role: Role, companyCode: string | null): boolean {
  return can(role, "home.summary", companyCode);
}

/** Ruta por defecto tras login, cambio de empresa o “ver como”. */
export function homePath(role: Role, companyCode: string | null): string {
  if (role === "KIOSCO_ASISTENCIA") return "/kiosco";
  if (role === "AYUDANTE_GENERAL") return "/personal/asistencia";
  if (
    can(role, "panel.view", companyCode)
    && (role === "TECNICO"
      || role === "SUPERVISOR_TECNICO"
      || role === "GERENTE_OPERATIVO_SYSTRON"
      || role === "GERENTE_OPERATIVO_SERVOMOTORES")
  ) {
    return "/panel";
  }
  if (role === "ALMACEN" && can(role, "custody.confirm", companyCode)) return "/custodia";
  return "/inicio";
}
