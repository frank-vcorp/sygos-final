import type { NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const showAlmacen = (role: Role) => role === "ALMACEN";

/** Menú lateral de Almacén SYSTRON: inicio = bandeja con pestañas + inventario y horas extra. */
export const ALMACEN_NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Inicio",
    links: [
      { href: "/custodia", label: "Entradas", show: (role, code) => showAlmacen(role) && can(role, "custody.confirm", code) },
      {
        href: "/custodia?vista=resguardo",
        label: "En resguardo",
        show: (role, code) => showAlmacen(role) && can(role, "custody.confirm", code),
      },
      {
        href: "/custodia?vista=fuera",
        label: "Salida a prueba",
        show: (role, code) => showAlmacen(role) && can(role, "custody.confirm", code),
      },
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
      { href: "/reportes", label: "Reportes", show: (role) => showAlmacen(role) && can(role, "report.view") },
    ],
  },
];
