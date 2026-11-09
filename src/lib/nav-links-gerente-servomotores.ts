import { requerimientosNavGroup, type NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const gerenteSm = (role: Role) => role === "GERENTE_OPERATIVO_SERVOMOTORES";

/** Menú lateral del Gerente Operativo Servomotores (empresa MOT, sin EQUI/almacén SYSTRON). */
export const GERENTE_SERVOMOTORES_NAV_GROUPS: NavGroupDef[] = [
  {
    title: null,
    links: [
      { href: "/panel", show: (role, code) => gerenteSm(role) && can(role, "panel.view", code) },
    ],
  },
  {
    title: "Comercial",
    links: [
      { href: "/prospectos", label: "Prospectos", show: (role, code) => gerenteSm(role) && can(role, "prospect.operate", code) },
      { href: "/clientes", show: (role, code) => gerenteSm(role) && (can(role, "client.create", code) || can(role, "client.edit", code)) },
      { href: "/cotizaciones", show: (role, code) => gerenteSm(role) && (can(role, "quote.create", code) || can(role, "quote.price", code) || can(role, "quote.follow", code)) },
      {
        href: "/ventas",
        label: "Venta de equipo",
        show: (role, code) => gerenteSm(role) && (can(role, "agenda.use", code) || can(role, "quote.follow", code)),
      },
      { href: "/agenda", show: (role, code) => gerenteSm(role) && can(role, "agenda.use", code) },
      { href: "/facturacion", show: (role, code) => gerenteSm(role) && (can(role, "invoice.request", code) || can(role, "invoice.issue", code)) },
      { href: "/cobranza", show: (role, code) => gerenteSm(role) && can(role, "receivable.view", code) },
      { href: "/pagos", show: (role, code) => gerenteSm(role) && (can(role, "payment.register", code) || can(role, "payment.validate", code)) },
    ],
  },
  {
    title: "Servicios",
    links: [
      { href: "/servicios/activos", show: (role, code) => gerenteSm(role) && can(role, "attention.catalog", code) },
      { href: "/servicios/historial", show: (role, code) => gerenteSm(role) && can(role, "attention.catalog", code) },
    ],
  },
  {
    title: "Compras",
    links: [
      {
        href: "/compras/listas",
        label: "Listas de compras",
        show: (role, code) => gerenteSm(role) && can(role, "purchase.operate", code),
      },
      { href: "/compras", show: (role, code) => gerenteSm(role) && can(role, "purchase.operate", code) },
      {
        href: "/compras?vista=oc",
        label: "Órdenes de compra",
        show: (role, code) => gerenteSm(role) && can(role, "purchase.operate", code),
      },
      { href: "/proveedores", show: (role, code) => gerenteSm(role) && can(role, "supplier.operate", code) },
    ],
  },
  {
    title: "Taller",
    links: [
      { href: "/motores", show: (role, code) => gerenteSm(role) && can(role, "mot.view", code) && can(role, "equipment.catalog", code) },
      { href: "/operacion", show: (role, code) => gerenteSm(role) && can(role, "operation.queue", code) },
      { href: "/custodia", show: (role, code) => gerenteSm(role) && can(role, "custody.confirm", code) },
      { href: "/inventario", show: (role, code) => gerenteSm(role) && can(role, "inventory.operate", code) },
    ],
  },
  {
    title: "Personal",
    links: [
      {
        href: "/personal/horas",
        label: "Horas extras",
        show: (role, code) => gerenteSm(role) && can(role, "overtime.capture", code),
      },
      { href: "/produccion", show: (role) => gerenteSm(role) && can(role, "production.view") },
      { href: "/reportes", show: (role) => gerenteSm(role) && can(role, "report.view") },
    ],
  },
  requerimientosNavGroup(),
];
