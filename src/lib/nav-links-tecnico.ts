import type { NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const tecnico = (role: Role) => role === "TECNICO";

/** Menú lateral del Técnico (SYSTRON). */
export const TECNICO_NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Servicios",
    links: [
      { href: "/servicios/activos", show: (role, code) => tecnico(role) && can(role, "attention.catalog", code) },
      { href: "/servicios/historial", show: (role, code) => tecnico(role) && can(role, "attention.catalog", code) },
    ],
  },
  {
    title: "Cuenta",
    links: [
      {
        href: "/personal/horas",
        label: "Horas extra",
        show: (role, code) => tecnico(role) && can(role, "overtime.capture", code),
      },
      {
        href: "/personal/vacaciones",
        label: "Vacaciones",
        show: (role, code) => tecnico(role) && can(role, "overtime.capture", code),
      },
      { href: "/cuenta", label: "Usuario", show: tecnico },
    ],
  },
];
