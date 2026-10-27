import type { NavGroupDef } from "@/lib/nav-links";
import { requerimientosNavGroup } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const supervisor = (role: Role) => role === "SUPERVISOR_TECNICO";

/** Menú lateral del Supervisor Técnico (SYSTRON). */
export const SUPERVISOR_NAV_GROUPS: NavGroupDef[] = [
  requerimientosNavGroup(),
  {
    title: null,
    links: [
      { href: "/panel", show: (role, code) => supervisor(role) && can(role, "panel.view", code) },
    ],
  },
  {
    title: "Servicios",
    links: [
      { href: "/servicios/activos", show: (role, code) => supervisor(role) && can(role, "attention.catalog", code) },
      { href: "/servicios/historial", show: (role, code) => supervisor(role) && can(role, "attention.catalog", code) },
    ],
  },
  {
    title: "Cuenta",
    links: [
      {
        href: "/personal/horas",
        label: "Horas extra",
        show: (role, code) => supervisor(role) && can(role, "overtime.capture", code),
      },
      {
        href: "/personal/vacaciones",
        label: "Vacaciones",
        show: (role, code) => supervisor(role) && can(role, "overtime.capture", code),
      },
      { href: "/cuenta", label: "Usuario", show: supervisor },
    ],
  },
];
