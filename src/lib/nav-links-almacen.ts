import type { NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const showAlmacen = (role: Role) => role === "ALMACEN";

/** Menú lateral de Almacén SYSTRON: inicio = bandeja de entradas + inventario y horas extra. */
export const ALMACEN_NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Inicio",
    direct: true,
    links: [
      { href: "/custodia", show: (role, code) => showAlmacen(role) && can(role, "custody.confirm", code) },
    ],
  },
  {
    title: null,
    links: [
      {
        href: "/inventario",
        label: "Inventario",
        show: (role, code) => showAlmacen(role) && can(role, "inventory.operate", code),
      },
      {
        href: "/personal/horas",
        label: "Horas extra",
        show: (role, code) => showAlmacen(role) && can(role, "overtime.capture", code),
      },
    ],
  },
];
