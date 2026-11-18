"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { confirmIntercompanyPayment, registerClientPayment, registerIntercompanyPayment, validatePayment } from "@/lib/billing";
import { sendPaymentComplementByEmail, sendPaymentComplementByWhatsApp } from "@/lib/billing-delivery";
import {
  cancelPaymentComplement,
  pollPaymentComplementCancellation,
  stampPaymentComplement,
} from "@/lib/facturapi";
import { setFlash } from "@/lib/flash";
import { optionalText, requiredText } from "@/lib/form";
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

export async function stampPaymentRepAction(formData: FormData) {
  "use server";
  const paymentId = requiredText(formData.get("paymentId"), "Pago");
  try {
    const session = await requireCompany();
    if (
      !can(session.role, "payment.validate", session.activeCompanyCode)
      && !can(session.role, "invoice.issue", session.activeCompanyCode)
    ) {
      throw new Error("No tienes permiso para timbrar complementos de pago.");
    }
    const payment = await prisma.payment.findFirst({
      where: session.activeCompanyCode === "SERVOMOTORES"
        ? { id: paymentId, OR: [{ companyId: session.activeCompanyId }, { kind: "INTERCOMPANIA" }] }
        : { id: paymentId, companyId: session.activeCompanyId },
      select: { id: true, kind: true, companyId: true },
    });
    if (!payment) throw new Error("Ese pago no pertenece a esta empresa.");
    if (payment.kind === "INTERCOMPANIA" && session.activeCompanyCode !== "SERVOMOTORES") {
      throw new Error("El REP intercompañía lo timbra Servomotores.");
    }
    const result = await stampPaymentComplement(payment.id, { isPaymentId: true });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/pagos/${paymentId}`);
}

export async function sendRepEmailAction(formData: FormData) {
  "use server";
  const paymentId = requiredText(formData.get("paymentId"), "Pago");
  const complementId = requiredText(formData.get("complementId"), "REP");
  try {
    const session = await requireCompany();
    if (
      !can(session.role, "payment.register", session.activeCompanyCode)
      && !can(session.role, "payment.validate", session.activeCompanyCode)
      && !can(session.role, "invoice.issue", session.activeCompanyCode)
    ) {
      throw new Error("No tienes permiso para enviar este complemento.");
    }
    const result = await sendPaymentComplementByEmail({
      companyId: session.activeCompanyId,
      complementId,
      toEmail: optionalText(formData.get("toEmail")),
      authorUserId: session.userId,
    });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/pagos/${paymentId}`);
}

export async function sendRepWhatsAppAction(formData: FormData) {
  "use server";
  const paymentId = requiredText(formData.get("paymentId"), "Pago");
  const complementId = requiredText(formData.get("complementId"), "REP");
  try {
    const session = await requireCompany();
    if (
      !can(session.role, "payment.register", session.activeCompanyCode)
      && !can(session.role, "payment.validate", session.activeCompanyCode)
      && !can(session.role, "invoice.issue", session.activeCompanyCode)
    ) {
      throw new Error("No tienes permiso para enviar este complemento.");
    }
    const result = await sendPaymentComplementByWhatsApp({
      companyId: session.activeCompanyId,
      complementId,
      phone: optionalText(formData.get("phone")),
      authorUserId: session.userId,
    });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/pagos/${paymentId}`);
}

export async function cancelPaymentRepAction(formData: FormData) {
  "use server";
  const paymentId = requiredText(formData.get("paymentId"), "Pago");
  const complementId = requiredText(formData.get("complementId"), "REP");
  try {
    const session = await requireCompany();
    if (
      session.role !== "CEO"
      && session.role !== "ADMINISTRADOR"
      && session.role !== "COORDINACION_ADMINISTRACION"
    ) {
      throw new Error("Solo Coordinación, CEO o Administrador pueden cancelar un REP.");
    }
    const rep = await prisma.paymentComplement.findFirst({
      where: { id: complementId, paymentId, companyId: session.activeCompanyId },
      select: { id: true },
    });
    if (!rep) throw new Error("El REP no pertenece a la empresa activa.");
    const result = await cancelPaymentComplement(rep.id, {
      motive: requiredText(formData.get("motive"), "Motivo SAT"),
      actorUserId: session.userId,
    });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/pagos/${paymentId}`);
}

export async function pollRepCancellationAction(formData: FormData) {
  "use server";
  const paymentId = requiredText(formData.get("paymentId"), "Pago");
  const complementId = requiredText(formData.get("complementId"), "REP");
  try {
    const session = await requireCompany();
    const rep = await prisma.paymentComplement.findFirst({
      where: { id: complementId, paymentId, companyId: session.activeCompanyId },
      select: { id: true },
    });
    if (!rep) throw new Error("El REP no pertenece a la empresa activa.");
    const result = await pollPaymentComplementCancellation(rep.id, { actorUserId: session.userId });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    await setFlash({ tone: "error", message: bubble(error) });
  }
  redirect(`/pagos/${paymentId}`);
}
