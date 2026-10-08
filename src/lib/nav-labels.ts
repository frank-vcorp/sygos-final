import type { Role } from "@/lib/roles";

/** Etiquetas de menú por rol (p. ej. vendedor SYSTRON). */
export function navLabel(href: string, role: Role, _companyCode: string | null): string | undefined {
  if (role !== "VENTAS") return undefined;
  switch (href) {
    case "/panel":
      return "Inicio";
    case "/ventas":
      return "Venta de equipos";
    case "/servicios/diagnostico":
      return "En diagnóstico";
    case "/servicios/reparacion":
      return "En reparación";
    case "/servicios/garantia":
      return "En diagnóstico de garantía";
    default:
      return undefined;
  }
}
