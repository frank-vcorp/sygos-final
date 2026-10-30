import type { NavGroupDef } from "@/lib/nav-links";
import { can } from "@/lib/permissions";
import type { Role } from "@/lib/roles";

const showCeo = (role: Role) => role === "CEO";

/** Menú lateral del CEO (solo navegación). */
export const CEO_NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Inicio",
    direct: true,
    links: [{ href: "/panel", show: showCeo }],
  },
  {
    title: "Servicios",
    links: [
      { href: "/servicios/activos", label: "Activos", show: (role, code) => showCeo(role) && can(role, "attention.catalog", code) },
      { href: "/servicios/historial", label: "Historial", show: (role, code) => showCeo(role) && can(role, "attention.catalog", code) },
    ],
  },
  {
    title: "Personal",
    links: [
      { href: "/nomina", label: "Nómina", show: showCeo },
      { href: "/personal", label: "Colaboradores", show: showCeo },
    ],
  },
  {
    title: "Configuración",
    links: [
      { href: "/configuracion#identidad", label: "Configuración general", show: showCeo },
      { href: "/configuracion#prioridades", label: "Prioridades y SLA", show: showCeo },
      { href: "/configuracion#integraciones", label: "WhatsApp y correo (SMTP)", show: showCeo },
      { href: "/usuarios", label: "Usuarios", show: showCeo },
    ],
  },
];
