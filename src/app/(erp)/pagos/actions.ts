"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { confirmIntercompanyPayment, registerClientPayment, registerIntercompanyPayment, validatePayment } from "@/lib/billing";
import { setFlash } from "@/lib/flash";
import { requiredText } from "@/lib/form";
import { moneyFromForm } from "@/lib/money";
import { can, type Action } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export type PaymentModalState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string };

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

async function runRegisterClientPayment(formData: FormData) {
  const session = await guard("payment.register");
  const method = formData.get("method") === "EFECTIVO" ? "EFECTIVO" : "TRANSFERENCIA";
  const receivableId = requiredText(formData.get("receivableId"), "Cuenta");
  const receivable = await prisma.receivable.findFirst({ where: { id: receivableId, companyId: session.activeCompanyId } });
  if (!receivable) throw new Error("Esa cuenta no es de esta empresa.");
  return registerClientPayment(session, {
    clientId: receivable.clientId,
    receivableId,
    amount: moneyFromForm(formData.get("amount")),
    method,
    receipt: requiredText(formData.get("receipt"), "Comprobante"),
    destination: requiredText(formData.get("destination"), "Destino"),
  });
}

export async function registerPaymentModalAction(
  _previousState: PaymentModalState,
  formData: FormData,
): Promise<PaymentModalState> {
  "use server";
  try {
    const payment = await runRegisterClientPayment(formData);
    await setFlash({ tone: "ok", message: `${payment.folio} registrado.` });
    revalidatePath("/pagos");
    revalidatePath("/cobranza");
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: bubble(error) };
  }
}

export async function registerPaymentAction(formData: FormData) {
  "use server";
  try {
    const payment = await runRegisterClientPayment(formData);
    await setFlash({ tone: "ok", message: `${payment.folio} registrado.` });
    redirect(`/pagos/${payment.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/pagos?nuevo=1");
  }
}

export async function validatePaymentAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("paymentId"), "Pago");
  try {
    const session = await guard("payment.validate");
    await validatePayment(session, id);
    await setFlash({ tone: "ok", message: "Pago validado. El saldo bajó." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/pagos/${id}`);
}

async function runIntercompanyPayment(formData: FormData) {
  const session = await guard("payment.validate");
  return registerIntercompanyPayment(session, {
    payableId: requiredText(formData.get("payableId"), "Cuenta por pagar"),
    amount: moneyFromForm(formData.get("amount")),
    receipt: requiredText(formData.get("receipt"), "Comprobante"),
    destination: requiredText(formData.get("destination"), "Cuenta de origen"),
  });
}

export async function intercompanyPaymentModalAction(
  _previousState: PaymentModalState,
  formData: FormData,
): Promise<PaymentModalState> {
  "use server";
  try {
    const payment = await runIntercompanyPayment(formData);
    await setFlash({ tone: "ok", message: `${payment.folio} salió de SYSTRON. Servomotores debe confirmar la entrada.` });
    revalidatePath("/pagos");
    return { status: "success" };
  } catch (error) {
    return { status: "error", message: bubble(error) };
  }
}

export async function intercompanyPaymentAction(formData: FormData) {
  "use server";
  try {
    const payment = await runIntercompanyPayment(formData);
    await setFlash({ tone: "ok", message: `${payment.folio} salió de SYSTRON. Servomotores debe confirmar la entrada.` });
    redirect(`/pagos/${payment.id}`);
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
    redirect("/pagos?nuevo=1");
  }
}

export async function confirmIntercompanyAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("paymentId"), "Pago");
  try {
    const session = await guard("payment.validate");
    await confirmIntercompanyPayment(session, id);
    await setFlash({ tone: "ok", message: "Recepción confirmada. Bajaron las dos cuentas." });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/pagos/${id}`);
}
