import { canSeeHomeSummary } from "@/lib/home";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

export type NavLinkDef = {
  href: string;
  show: (role: Role, companyCode: string | null) => boolean;
};

export const NAV_GROUPS: Array<{ title: string | null; links: NavLinkDef[] }> = [
  {
    title: null,
    links: [
      { href: "/inicio", show: (role, code) => canSeeHomeSummary(role, code) },
      { href: "/panel", show: (role) => can(role, "panel.view") },
    ],
  },
  {
    title: "Comercial",
    links: [
      { href: "/clientes", show: (role, code) => can(role, "client.create", code) || can(role, "client.edit", code) },
      { href: "/prospectos", show: (role, code) => can(role, "prospect.operate", code) },
      { href: "/cotizaciones", show: (role, code) => can(role, "quote.create", code) || can(role, "quote.price", code) },
      { href: "/ventas", show: (role, code) => can(role, "agenda.use", code) || can(role, "quote.follow", code) },
      { href: "/agenda", show: (role, code) => can(role, "agenda.use", code) },
      { href: "/facturacion", show: (role, code) => can(role, "invoice.request", code) || can(role, "invoice.issue", code) },
      { href: "/cobranza", show: (role, code) => can(role, "receivable.view", code) },
      { href: "/pagos", show: (role, code) => can(role, "payment.register", code) || can(role, "payment.validate", code) },
      { href: "/compras", show: (role, code) => can(role, "purchase.operate", code) },
      { href: "/finanzas", show: (role, code) => can(role, "finance.view", code) },
    ],
  },
  {
    title: "Personal",
    links: [
      { href: "/personal", show: (role) => can(role, "personnel.manage") },
      { href: "/personal/asistencia", show: (role) => can(role, "personnel.manage") },
      { href: "/personal/horas", show: (role, code) => can(role, "overtime.capture", code) || can(role, "personnel.authorize") },
      { href: "/nomina", show: (role) => can(role, "personnel.manage") },
      { href: "/comisiones", show: (role) => can(role, "personnel.manage") },
      { href: "/produccion", show: (role) => can(role, "production.view") },
      { href: "/reportes", show: (role) => can(role, "report.view") },
      { href: "/kiosco", show: (role) => role === "KIOSCO_ASISTENCIA" },
    ],
  },
  {
    title: "Servicios",
    links: [
      { href: "/servicios/diagnostico", show: (role, code) => can(role, "attention.catalog", code) },
      { href: "/servicios/reparacion", show: (role, code) => can(role, "attention.catalog", code) },
      { href: "/servicios/garantia", show: (role, code) => can(role, "attention.catalog", code) },
      { href: "/operacion", show: (role, code) => can(role, "operation.queue", code) },
    ],
  },
  {
    title: "Taller",
    links: [
      { href: "/equipos", show: (role, code) => can(role, "equipment.catalog", code) },
      { href: "/motores", show: (role, code) => can(role, "equipment.catalog", code) && can(role, "mot.view", code) },
      { href: "/custodia", show: (role, code) => can(role, "custody.confirm", code) },
      { href: "/inventario", show: (role, code) => can(role, "inventory.operate", code) },
    ],
  },
  {
    title: "Administración",
    links: [
      { href: "/proveedores", show: (role, code) => can(role, "supplier.operate", code) },
      { href: "/usuarios", show: (role) => can(role, "user.manage") },
      { href: "/configuracion", show: (role) => can(role, "config.company") || can(role, "config.integrations") },
      { href: "/pruebas", show: (role) => role === "ADMINISTRADOR" },
    ],
  },
];

export function visibleNavHrefs(role: Role, companyCode: string | null): string[] {
  return NAV_GROUPS.flatMap((group) => group.links.filter((link) => link.show(role, companyCode)).map((link) => link.href));
}
