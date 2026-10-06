"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { requiredText } from "@/lib/form";
import { can } from "@/lib/permissions";
import { attachProof, manualMovement, openAccount, payCard, payPayable, transferAccounts } from "@/lib/purchases";
import { requireCompany } from "@/lib/session";

function bubble(error: unknown) {
  const redirecting = typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
  if (redirecting) throw error;
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

async function guard() {
  const session = await requireCompany();
  if (!can(session.role, "finance.manage", session.activeCompanyCode)) throw new Error("No tienes permiso para esta acción.");
  return session;
}

export async function accountAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    const kind = formData.get("kind") === "TARJETA" ? "TARJETA" : formData.get("kind") === "EFECTIVO" ? "EFECTIVO" : "BANCO";
    await openAccount(session, requiredText(formData.get("name"), "Nombre"), kind, Number(formData.get("opening") || 0));
    await setFlash({ tone: "ok", message: "Cuenta registrada." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/finanzas");
}

export async function movementAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    const direction = formData.get("direction") === "INGRESO" ? "INGRESO" : "EGRESO";
    await manualMovement(session, requiredText(formData.get("accountId"), "Cuenta"), direction, Number(formData.get("amount")), requiredText(formData.get("category"), "Categoría"), requiredText(formData.get("note"), "Nota"), formData.get("pendingProof") === "si");
    await setFlash({ tone: "ok", message: "Movimiento confirmado." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/finanzas");
}

export async function transferAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    await transferAccounts(session, requiredText(formData.get("fromId"), "Origen"), requiredText(formData.get("toId"), "Destino"), Number(formData.get("amount")));
    await setFlash({ tone: "ok", message: "Transferencia registrada. No es ingreso ni gasto." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/finanzas");
}

export async function proofAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    await attachProof(session, requiredText(formData.get("movementId"), "Movimiento"), requiredText(formData.get("proofNote"), "Comprobante"));
    await setFlash({ tone: "ok", message: "Comprobante relacionado. No hubo una segunda salida." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/finanzas");
}

export async function payPayableAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    await payPayable(session, requiredText(formData.get("payableId"), "Cuenta por pagar"), requiredText(formData.get("accountId"), "Cuenta"), Number(formData.get("amount")));
    await setFlash({ tone: "ok", message: "Pago aplicado. La compra no se reabrió." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/finanzas");
}

export async function payCardAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    await payCard(session, requiredText(formData.get("cardId"), "Tarjeta"), requiredText(formData.get("bankId"), "Banco"), Number(formData.get("amount")));
    await setFlash({ tone: "ok", message: "La deuda de la tarjeta bajó y el banco registró el egreso." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect("/finanzas");
}
