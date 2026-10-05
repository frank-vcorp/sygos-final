"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { requiredText } from "@/lib/form";
import { can } from "@/lib/permissions";
import { deliverSaleLine, receiveSaleLine } from "@/lib/quotes";
import { requireCompany } from "@/lib/session";

export async function receiveSaleAction(formData: FormData) {
  "use server";
  const saleId = requiredText(formData.get("saleId"), "Venta");
  try {
    const session = await requireCompany();
    if (!can(session.role, "sale.receive", session.activeCompanyCode)) throw new Error("Almacén confirma la recepción.");
    await receiveSaleLine(session, requiredText(formData.get("lineId"), "Línea"), Number(formData.get("quantity")));
    await setFlash({ tone: "ok", message: "Recepción registrada. No marca toda la venta como disponible." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo recibir." });
  }
  redirect(`/ventas/${saleId}`);
}

export async function deliverSaleAction(formData: FormData) {
  "use server";
  const saleId = requiredText(formData.get("saleId"), "Venta");
  try {
    const session = await requireCompany();
    if (!can(session.role, "sale.receive", session.activeCompanyCode)) throw new Error("Almacén confirma la entrega.");
    await deliverSaleLine(session, requiredText(formData.get("lineId"), "Línea"), Number(formData.get("quantity")));
    await setFlash({ tone: "ok", message: "Entrega parcial registrada." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo entregar." });
  }
  redirect(`/ventas/${saleId}`);
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
