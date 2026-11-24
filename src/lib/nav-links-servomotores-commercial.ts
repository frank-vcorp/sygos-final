import { requerimientosNavGroup, type NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

/** Menú lateral comercial de Servomotores (gerente u auxiliar operativo). */
export function servomotoresCommercialNavGroups(matchesRole: (role: Role) => boolean): NavGroupDef[] {
  const show = (role: Role, code: string | null) => matchesRole(role);
  return [
    {
      title: null,
      links: [
        { href: "/panel", show: (role, code) => show(role, code) && can(role, "panel.view", code) },
        { href: "/agenda", show: (role, code) => show(role, code) && can(role, "agenda.use", code) },
      ],
    },
    {
      title: "Comercial",
      links: [
        { href: "/prospectos", label: "Prospectos", show: (role, code) => show(role, code) && can(role, "prospect.operate", code) },
        { href: "/clientes", show: (role, code) => show(role, code) && (can(role, "client.create", code) || can(role, "client.edit", code)) },
        { href: "/motores", show: (role, code) => show(role, code) && can(role, "mot.view", code) && can(role, "equipment.catalog", code) },
        { href: "/cotizaciones", show: (role, code) => show(role, code) && (can(role, "quote.create", code) || can(role, "quote.price", code) || can(role, "quote.follow", code)) },
        {
          href: "/ventas",
          label: "Venta de equipo",
          show: (role, code) => show(role, code) && (can(role, "agenda.use", code) || can(role, "quote.follow", code)),
        },
      ],
    },
    {
      title: "Servicios",
      links: [
        { href: "/servicios/activos", show: (role, code) => show(role, code) && can(role, "attention.catalog", code) },
        { href: "/servicios/historial", show: (role, code) => show(role, code) && can(role, "attention.catalog", code) },
      ],
    },
    {
      title: "Administración",
      links: [
        { href: "/facturacion", show: (role, code) => show(role, code) && (can(role, "invoice.request", code) || can(role, "invoice.issue", code)) },
        { href: "/cobranza", show: (role, code) => show(role, code) && can(role, "receivable.view", code) },
        { href: "/pagos", show: (role, code) => show(role, code) && (can(role, "payment.register", code) || can(role, "payment.validate", code)) },
      ],
    },
    {
      title: "Compras",
      links: [
        {
          href: "/compras/listas",
          label: "Listas de compras",
          show: (role, code) => show(role, code) && can(role, "purchase.operate", code),
        },
        {
          href: "/compras",
          label: "Compras",
          show: (role, code) => show(role, code) && can(role, "purchase.operate", code),
        },
        {
          href: "/compras?vista=oc",
          label: "Órdenes de compra",
          show: (role, code) => show(role, code) && can(role, "purchase.operate", code),
        },
        { href: "/proveedores", label: "Proveedores", show: (role, code) => show(role, code) && can(role, "supplier.operate", code) },
      ],
    },
    {
      title: "Personal",
      links: [
        {
          href: "/personal/horas",
          label: "Horas extras",
          show: (role, code) => show(role, code) && can(role, "overtime.capture", code),
        },
        {
          href: "/personal/vacaciones",
          label: "Vacaciones",
          show: (role, code) => show(role, code) && can(role, "overtime.capture", code),
        },
      ],
    },
    {
      title: "Almacén",
      links: [
        {
          href: "/inventario",
          label: "Inventario",
          show: (role, code) => show(role, code) && can(role, "inventory.operate", code),
        },
      ],
    },
    requerimientosNavGroup(),
  ];
}