import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

/** Pantalla de arranque por rol (sin resumen global en /inicio). */
export function homePath(role: Role, companyCode: string | null): string {
  if (role === "KIOSCO_ASISTENCIA") return "/kiosco";
  if (role === "AYUDANTE_GENERAL") return "/personal/asistencia";
  if (role === "ALMACEN" && can(role, "custody.confirm", companyCode)) return "/custodia";
  if (can(role, "panel.view", companyCode)) return "/panel";
  if (can(role, "custody.confirm", companyCode)) return "/custodia";
  if (can(role, "inventory.operate", companyCode)) return "/inventario";
  return "/panel";
}
