import type { NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const ventas = (role: Role) => role === "VENTAS";

function showEquiCatalog(role: Role, companyCode: string | null) {
  if (!can(role, "equi.view", companyCode)) return false;
  return ventas(role) || can(role, "equipment.catalog", companyCode);
}

/** Menú lateral del rol Ventas (SYSTRON). */
export const VENTAS_NAV_GROUPS: NavGroupDef[] = [
  {
    title: null,
    links: [
      { href: "/panel", show: (role, code) => ventas(role) && can(role, "panel.view", code) },
      { href: "/agenda", show: (role, code) => ventas(role) && can(role, "agenda.use", code) },
    ],
  },
  {
    title: "Servicios",
    links: [
      { href: "/servicios/activos", show: (role, code) => ventas(role) && can(role, "attention.catalog", code) },
      { href: "/servicios/historial", show: (role, code) => ventas(role) && can(role, "attention.catalog", code) },
    ],
  },
  {
    title: "Comercial",
    links: [
      { href: "/prospectos", label: "Prospecto", show: (role, code) => ventas(role) && can(role, "prospect.operate", code) },
      { href: "/clientes", show: (role, code) => ventas(role) && (can(role, "client.create", code) || can(role, "client.edit", code)) },
      { href: "/equipos", show: (role, code) => ventas(role) && showEquiCatalog(role, code) },
      { href: "/cotizaciones", show: (role, code) => ventas(role) && (can(role, "quote.create", code) || can(role, "quote.price", code)) },
      { href: "/ventas", label: "Venta de equipo", show: (role, code) => ventas(role) && (can(role, "agenda.use", code) || can(role, "quote.follow", code)) },
    ],
  },
  {
    title: "Administración",
    links: [
      { href: "/facturacion", show: (role, code) => ventas(role) && (can(role, "invoice.request", code) || can(role, "invoice.issue", code)) },
      { href: "/cobranza", show: (role, code) => ventas(role) && can(role, "receivable.view", code) },
      { href: "/pagos", show: (role, code) => ventas(role) && (can(role, "payment.register", code) || can(role, "payment.validate", code)) },
    ],
  },
  {
    title: "Cuenta",
    links: [
      { href: "/personal/horas", label: "Horas extra", show: (role, code) => ventas(role) && can(role, "overtime.capture", code) },
      { href: "/cuenta", label: "Usuario", show: ventas },
    ],
  },
];
