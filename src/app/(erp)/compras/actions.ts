"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { supplierIdFromForm } from "@/lib/form-quick-entities";
import { optionalText, parseVersion, requiredText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import { cancelOrder, changeAuthorizedOrder, decideOrder, discardDirectPurchase, editDirectPurchase, processPurchase, registerDirectPurchase, registerOrder } from "@/lib/purchases";
import { requireCompany } from "@/lib/session";

async function guard(action: Action) {
  const session = await requireCompany();
  if (!can(session.role, action, session.activeCompanyCode)) throw new Error("No tienes permiso para esta acción.");
  return session;
}

function bubble(error: unknown) {
  const redirecting = typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
  if (redirecting) throw error;
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export async function directPurchaseAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("purchase.operate");
    const supplierId = await supplierIdFromForm(session, formData, { required: true });
    if (!supplierId) throw new Error("Elige un proveedor.");
    const purchase = await registerDirectPurchase(session, {
      supplierId,
      concept: requiredText(formData.get("concept"), "Concepto"),
      amount: Number(formData.get("amount")),
      destination: requiredText(formData.get("destination"), "Destino"),
      destinationRef: optionalText(formData.get("destinationRef")),
      quantity: Number(formData.get("quantity") || 1),
    });
    await setFlash({ tone: "ok", message: `${purchase.folio} registrada dentro del presupuesto.` });
    redirect(`/compras/${purchase.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/compras/nueva");
  }
}

export async function orderAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("purchase.operate");
    const purchase = await registerOrder(session, {
      supplierId: await supplierIdFromForm(session, formData),
      concept: requiredText(formData.get("concept"), "Concepto"),
      amount: Number(formData.get("amount")),
      destination: requiredText(formData.get("destination"), "Destino"),
      destinationRef: optionalText(formData.get("destinationRef")),
      quantity: Number(formData.get("quantity") || 1),
    });
    await setFlash({ tone: "ok", message: `${purchase.folio} registrada.` });
    redirect(`/compras/${purchase.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/compras/oc");
  }
}

export async function decideOrderAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("purchase.authorize");
    await decideOrder(session, id, parseVersion(formData.get("version")), formData.get("decision") === "si");
    await setFlash({ tone: "ok", message: "Decisión registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}

export async function editDirectAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    await editDirectPurchase(session, id, parseVersion(formData.get("version")), Number(formData.get("amount")));
    await setFlash({ tone: "ok", message: "Compra cuadrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}

export async function discardDirectAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    await discardDirectPurchase(session, id, parseVersion(formData.get("version")));
    await setFlash({ tone: "ok", message: "Compra eliminada. El presupuesto quedó libre." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/compras");
}

export async function changeOrderAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    await changeAuthorizedOrder(session, id, parseVersion(formData.get("version")), {
      supplierId: await supplierIdFromForm(session, formData),
      concept: requiredText(formData.get("concept"), "Concepto"),
      amount: Number(formData.get("amount")),
    });
    await setFlash({ tone: "ok", message: "El cambio volvió a autorización del CEO." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}

export async function cancelOrderAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    if (session.role !== "CEO" && session.role !== "ADMINISTRADOR" && session.role !== "COORDINACION_ADMINISTRACION") {
      throw new Error("CEO o Coordinación cancelan la orden.");
    }
    await cancelOrder(session, id, parseVersion(formData.get("version")), requiredText(formData.get("reason"), "Motivo"));
    await setFlash({ tone: "ok", message: "Orden cancelada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}

export async function processPurchaseAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("purchaseId"), "Compra");
  try {
    const session = await guard("finance.manage");
    const settlement = formData.get("settlement") === "CREDITO" ? "CREDITO" : "CONTADO";
    await processPurchase(session, id, parseVersion(formData.get("version")), settlement, optionalText(formData.get("accountId")));
    await setFlash({ tone: "ok", message: settlement === "CREDITO" ? "Quedó una cuenta por pagar." : "Quedó un egreso." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/compras/${id}`);
}
