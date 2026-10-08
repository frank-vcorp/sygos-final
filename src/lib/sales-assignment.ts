import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import type { AppSession } from "@/lib/session";
import type { Role } from "@/lib/roles";

export const SALES_NOT_ASSIGNED_MESSAGE = "Este registro no está asignado a ti.";

/** Cliente asignado al vendedor en cartera (no clientes sistema / intercompañía). */
export function salesPortfolioClientWhere(role: Role, userId: string) {
  if (role !== "VENTAS") return {};
  return { ownerUserId: userId, isSystem: false };
}

export function salesPortfolioEquipmentWhere(role: Role, userId: string) {
  const client = salesPortfolioClientWhere(role, userId);
  if (!("ownerUserId" in client)) return {};
  return { client };
}

export function salesPortfolioUserId(role: Role, userId: string): string | undefined {
  return role === "VENTAS" ? userId : undefined;
}

/** Ventas solo ve registros cuyo vendedor/responsable comercial es el usuario activo. */
export async function redirectIfSalesNotAssigned(
  session: Pick<AppSession, "role" | "userId">,
  assignedUserId: string | null | undefined,
  backHref: string,
) {
  if (session.role !== "VENTAS") return;
  if (assignedUserId === session.userId) return;
  await setFlash({ tone: "error", message: SALES_NOT_ASSIGNED_MESSAGE });
  redirect(backHref);
}
