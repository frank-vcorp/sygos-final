import type { Role } from "@/lib/roles";

/** Coord y CEO ven facturas y remisiones en rutas separadas (/facturacion vs /remisiones). */
export function billingUsesSplitRemisionesNav(role: Role): boolean {
  return role === "COORDINACION_ADMINISTRACION" || role === "CEO";
}

export function billingListBackHref(role: Role, kind: string): { href: string; label: string } {
  if (kind === "REMISION" && billingUsesSplitRemisionesNav(role)) {
    return { href: "/remisiones", label: "Remisiones" };
  }
  return { href: "/facturacion", label: "Facturación" };
}