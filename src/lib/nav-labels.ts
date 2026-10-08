import type { Role } from "@/lib/roles";

/** Etiquetas de menú por rol (p. ej. vendedor SYSTRON). */
export function navLabel(href: string, role: Role, _companyCode: string | null): string | undefined {
  const base = href.split("?")[0]!;
  if (role === "VENTAS" && base === "/ventas") return "Venta de equipos";
  return undefined;
}
