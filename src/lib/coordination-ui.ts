import type { Role } from "@/lib/roles";

/** Coordinación de Administración usa el menú lateral; no repetir sub-navegación en página. */
export function coordUsesSidebarNav(role: Role): boolean {
  return role === "COORDINACION_ADMINISTRACION";
}
