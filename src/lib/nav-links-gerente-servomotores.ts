import { requerimientosNavGroup, type NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const gerenteSm = (role: Role) => role === "GERENTE_OPERATIVO_SERVOMOTORES";

/** Menú lateral del Gerente Operativo Servomotores — misma estructura que SYSTRON gerente; lo comercial vive en /panel. */
export const GERENTE_SERVOMOTORES_NAV_GROUPS: NavGroupDef[] = [
  {
    title: null,
    links: [
      { href: "/panel", show: (role, code) => gerenteSm(role) && can(role, "panel.view", code) },
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
      {
        href: "/compras",
        label: "Compras",
        show: (role, code) => gerenteSm(role) && can(role, "purchase.operate", code),
      },
      {
        href: "/compras?vista=oc",
        label: "Órdenes de compra",
        show: (role, code) => gerenteSm(role) && can(role, "purchase.operate", code),
      },
      {
        href: "/proveedores",
        label: "Proveedores",
        show: (role, code) => gerenteSm(role) && can(role, "supplier.operate", code),
      },
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
      {
        href: "/personal/vacaciones",
        label: "Vacaciones",
        show: (role, code) => gerenteSm(role) && can(role, "overtime.capture", code),
      },
    ],
  },
  {
    title: "Almacén",
    links: [
      {
        href: "/inventario",
        label: "Inventario",
        show: (role, code) => gerenteSm(role) && can(role, "inventory.operate", code),
      },
    ],
  },
  requerimientosNavGroup(),
];
