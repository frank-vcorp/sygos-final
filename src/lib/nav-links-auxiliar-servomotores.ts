import { servomotoresCommercialNavGroups } from "@/lib/nav-links-servomotores-commercial";
import type { NavGroupDef } from "@/lib/nav-links";
import type { Role } from "@/lib/roles";

/** Auxiliar Operativo Servomotores: mismo menú comercial/compras que el gerente, sin operación técnica. */
export const AUXILIAR_SERVOMOTORES_NAV_GROUPS: NavGroupDef[] = servomotoresCommercialNavGroups(
  (role) => role === "AUXILIAR_OPERATIVO_SERVOMOTORES",
);