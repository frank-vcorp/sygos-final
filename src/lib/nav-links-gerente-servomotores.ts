import { servomotoresCommercialNavGroups } from "@/lib/nav-links-servomotores-commercial";
import type { NavGroupDef } from "@/lib/nav-links";
import type { Role } from "@/lib/roles";

/** Gerente Operativo Servomotores: comercial + taller vía panel y Servicios (sin cola /operacion en menú). */
export const GERENTE_SERVOMOTORES_NAV_GROUPS: NavGroupDef[] = servomotoresCommercialNavGroups(
  (role) => role === "GERENTE_OPERATIVO_SERVOMOTORES",
);