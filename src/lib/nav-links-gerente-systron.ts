import type { NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const gerenteSystron = (role: Role) => role === "GERENTE_OPERATIVO_SYSTRON";

/** Menú lateral del Gerente Operativo SYSTRON. */
export const GERENTE_SYSTRON_NAV_GROUPS: NavGroupDef[] = [
  {
    title: null,
    links: [
      { href: "/panel", show: (role, code) => gerenteSystron(role) && can(role, "panel.view", code) },
    ],
  },
  {
    title: "Servicios",
    links: [
      { href: "/servicios/activos", show: (role, code) => gerenteSystron(role) && can(role, "attention.catalog", code) },
      { href: "/servicios/historial", show: (role, code) => gerenteSystron(role) && can(role, "attention.catalog", code) },
    ],
  },
  {
    title: "Compras",
    links: [
      {
        href: "/compras/requerimientos",
        label: "Requerimientos",
        show: (role, code) => gerenteSystron(role) && can(role, "purchase.operate", code),
      },
      {
        href: "/compras?vista=directas",
        label: "Compras",
        show: (role, code) => gerenteSystron(role) && can(role, "purchase.operate", code),
      },
      {
        href: "/compras?vista=oc",
        label: "Órdenes de compra",
        show: (role, code) => gerenteSystron(role) && can(role, "purchase.operate", code),
      },
      {
        href: "/proveedores",
        show: (role, code) => gerenteSystron(role) && can(role, "supplier.operate", code),
      },
    ],
  },
  {
    title: "Personal",
    links: [
      {
        href: "/personal/horas",
        label: "Horas extras",
        show: (role, code) => gerenteSystron(role) && can(role, "overtime.capture", code),
      },
      {
        href: "/personal/vacaciones",
        label: "Vacaciones",
        show: (role, code) => gerenteSystron(role) && can(role, "overtime.capture", code),
      },
    ],
  },
  {
    title: "Almacén",
    links: [
      {
        href: "/inventario",
        label: "Inventario",
        show: (role, code) => gerenteSystron(role) && can(role, "inventory.operate", code),
      },
    ],
  },
];
