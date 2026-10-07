import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import type { AppSession } from "@/lib/session";

export const SALES_NOT_ASSIGNED_MESSAGE = "Este registro no está asignado a ti.";

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
