import type { Role } from "@/lib/roles";

/** Etiquetas de menú por rol (p. ej. vendedor SYSTRON). */
export function navLabel(href: string, role: Role, _companyCode: string | null): string | undefined {
  if (role !== "VENTAS") return undefined;
  switch (href) {
    case "/ventas":
      return "Venta de equipos";
    default:
      return undefined;
  }
}
