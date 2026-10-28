import type { NavGroupDef } from "@/lib/nav-links";
import type { Role } from "@/lib/roles";

const ayudante = (role: Role) => role === "AYUDANTE_GENERAL";

/** Menú lateral del Ayudante General (Servomotores): solo cuenta de usuario. */
export const AYUDANTE_NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Cuenta",
    links: [{ href: "/cuenta", label: "Usuario", show: ayudante }],
  },
];
