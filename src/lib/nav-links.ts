import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

export type NavLinkDef = {
  href: string;
  show: (role: Role, companyCode: string | null) => boolean;
};

export type NavGroupDef = {
  title: string | null;
  links: NavLinkDef[];
  /** Título en mayúsculas como enlace directo, sin submenú desplegable. */
  direct?: boolean;
};

const ventas = (role: Role) => role === "VENTAS";
const notVentas = (role: Role) => role !== "VENTAS";
function showServiciosCatalogNav(role: Role, companyCode: string | null) {
  return can(role, "attention.catalog", companyCode);
}

/** Operación vía Servicios + detalle; técnico y supervisor no ven acordeón Taller. */
const showTallerNav = (role: Role) => role !== "TECNICO" && role !== "SUPERVISOR_TECNICO";

/** Catálogo EQUI: SYSTRON y roles con bandeja; nunca Servomotores (sin equi.view allí). */
function showEquiCatalog(role: Role, companyCode: string | null) {
  if (!can(role, "equi.view", companyCode)) return false;
  return ventas(role) || can(role, "equipment.catalog", companyCode);
}

export const NAV_GROUPS: NavGroupDef[] = [
  {
    title: null,
    links: [
      { href: "/panel", show: (role) => can(role, "panel.view") },
    ],
  },
  {
    title: "Comercial",
    links: [
      { href: "/cotizaciones", show: (role, code) => can(role, "quote.create", code) || can(role, "quote.price", code) },
      { href: "/ventas", show: (role, code) => ventas(role) && (can(role, "agenda.use", code) || can(role, "quote.follow", code)) },
      { href: "/clientes", show: (role, code) => can(role, "client.create", code) || can(role, "client.edit", code) },
      { href: "/prospectos", show: (role, code) => can(role, "prospect.operate", code) },
      { href: "/equipos", show: (role, code) => ventas(role) && showEquiCatalog(role, code) },
      { href: "/ventas", show: (role, code) => notVentas(role) && (can(role, "agenda.use", code) || can(role, "quote.follow", code)) },
      { href: "/agenda", show: (role, code) => can(role, "agenda.use", code) && notVentas(role) },
      { href: "/facturacion", show: (role, code) => notVentas(role) && (can(role, "invoice.request", code) || can(role, "invoice.issue", code)) },
      { href: "/cobranza", show: (role, code) => notVentas(role) && can(role, "receivable.view", code) },
      { href: "/pagos", show: (role, code) => notVentas(role) && (can(role, "payment.register", code) || can(role, "payment.validate", code)) },
      { href: "/compras", show: (role, code) => can(role, "purchase.operate", code) },
      { href: "/finanzas", show: (role, code) => can(role, "finance.view", code) },
    ],
  },
  {
    title: "Servicios",
    direct: true,
    links: [
      {
        href: "/servicios",
        show: (role, code) => showServiciosCatalogNav(role, code),
      },
    ],
  },
  {
    title: "Personal",
    links: [
      { href: "/personal", show: (role) => can(role, "personnel.manage") },
      { href: "/personal/asistencia", show: (role) => can(role, "personnel.manage") },
      { href: "/personal/horas", show: (role, code) => notVentas(role) && (can(role, "overtime.capture", code) || can(role, "personnel.authorize")) },
      { href: "/nomina", show: (role) => can(role, "personnel.manage") },
      { href: "/comisiones", show: (role) => can(role, "personnel.manage") },
      { href: "/produccion", show: (role) => can(role, "production.view") },
      { href: "/reportes", show: (role) => can(role, "report.view") },
      { href: "/kiosco", show: (role) => role === "KIOSCO_ASISTENCIA" },
    ],
  },
  {
    title: "Taller",
    links: [
      { href: "/equipos", show: (role, code) => showTallerNav(role) && notVentas(role) && showEquiCatalog(role, code) },
      { href: "/motores", show: (role, code) => showTallerNav(role) && notVentas(role) && can(role, "equipment.catalog", code) && can(role, "mot.view", code) },
      { href: "/operacion", show: (role, code) => showTallerNav(role) && can(role, "operation.queue", code) && notVentas(role) },
      { href: "/custodia", show: (role, code) => showTallerNav(role) && can(role, "custody.confirm", code) },
      { href: "/inventario", show: (role, code) => showTallerNav(role) && can(role, "inventory.operate", code) },
    ],
  },
  {
    title: "Administración",
    links: [
      { href: "/cobranza", show: (role, code) => ventas(role) && can(role, "receivable.view", code) },
      { href: "/facturacion", show: (role, code) => ventas(role) && (can(role, "invoice.request", code) || can(role, "invoice.issue", code)) },
      { href: "/pagos", show: (role, code) => ventas(role) && (can(role, "payment.register", code) || can(role, "payment.validate", code)) },
      { href: "/personal/horas", show: (role, code) => ventas(role) && can(role, "overtime.capture", code) },
      { href: "/proveedores", show: (role, code) => notVentas(role) && can(role, "supplier.operate", code) },
      { href: "/usuarios", show: (role) => notVentas(role) && can(role, "user.manage") },
      { href: "/configuracion", show: (role) => notVentas(role) && (can(role, "config.company") || can(role, "config.integrations")) },
      { href: "/pruebas", show: (role) => role === "ADMINISTRADOR" },
    ],
  },
];

export function visibleNavHrefs(role: Role, companyCode: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of NAV_GROUPS) {
    for (const link of group.links) {
      if (!link.show(role, companyCode) || seen.has(link.href)) continue;
      seen.add(link.href);
      out.push(link.href);
    }
  }
  return out;
}
