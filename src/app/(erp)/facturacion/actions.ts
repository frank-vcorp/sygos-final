"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { clientIdFromForm } from "@/lib/form-quick-entities";
import { optionalText, requiredText } from "@/lib/form";
import { moneyFromForm } from "@/lib/money";
import { can, type Action } from "@/lib/permissions";
import {
  authorizeAndExecuteDocumentCancellation,
  authorizeDocumentCancellation,
  executeDocumentCancellation,
  issueCreditNote,
  issueDocument,
  issueFreeInvoice,
  requestDocumentCancellation,
  requestFromQuote,
  requestIntercompany,
  patchBillingLineSatKeys,
  retryFiscal,
} from "@/lib/billing";
import { sendBillingDocumentByEmail, sendBillingDocumentByWhatsApp } from "@/lib/billing-delivery";
import { prisma } from "@/lib/db";
import { pollBillingDocumentCancellation } from "@/lib/facturapi";
import { parseCfdiUse } from "@/lib/sat-cfdi-use";
import { parsePaymentForm, parsePaymentMethod } from "@/lib/sat-payment-method";
import { billingSalesCannotMutateMessage, billingSalesDetailReadOnly } from "@/lib/billing-sales";
import { requireCompany } from "@/lib/session";

function fiscalFromForm(formData: FormData) {
  const cfdiUse = parseCfdiUse(formData.get("cfdiUse"));
  const paymentMethod = parsePaymentMethod(formData.get("paymentMethod"));
  const paymentForm = parsePaymentForm(formData.get("paymentForm"));
  return { cfdiUse, paymentMethod, paymentForm };
}

async function guard(action: Action) {
  const session = await requireCompany();
  if (!can(session.role, action, session.activeCompanyCode)) {
    await setFlash({ tone: "error", message: "No tienes permiso para esta acción." });
    redirect("/facturacion");
  }
  return session;
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

export async function requestDocumentAction(formData: FormData) {
  "use server";
  const quoteId = String(formData.get("quoteId") ?? "");
  try {
    const session = await guard("invoice.request");
    const kind = formData.get("kind") === "REMISION" ? "REMISION" : "FACTURA";
    const document = await requestFromQuote(session, requiredText(quoteId, "Cotización"), kind, null);
    await setFlash({ tone: "ok", message: `${document.folio} quedó solicitado.` });
    redirect(quoteId ? `/cotizaciones/${quoteId}` : "/facturacion?vista=solicitudes");
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(quoteId ? `/cotizaciones/${quoteId}` : "/facturacion");
  }
}

export async function requestIntercompanyAction(formData: FormData) {
  "use server";
  const quoteId = String(formData.get("quoteId") ?? "");
  try {
    const session = await guard("invoice.request");
    const document = await requestIntercompany(session, requiredText(quoteId, "Cotización"));
    await setFlash({ tone: "ok", message: `${document.folio} solicita la factura a SYSTRON.` });
    redirect(quoteId ? `/cotizaciones/${quoteId}` : "/facturacion?vista=solicitudes");
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(quoteId ? `/cotizaciones/${quoteId}` : "/facturacion");
  }
}

export async function issueDocumentAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  try {
    const session = await guard("invoice.issue");
    await issueDocument(session, id, fiscalFromForm(formData));
    await setFlash({ tone: "ok", message: "Documento emitido." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function retryFiscalAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  try {
    const session = await guard("invoice.issue");
    await retryFiscal(session, id, fiscalFromForm(formData));
    await setFlash({ tone: "ok", message: "Reintento registrado sobre el mismo documento." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function freeInvoiceAction(formData: FormData) {
  "use server";
  try {
    const session = await guard("invoice.issue");
    const { clientId } = await clientIdFromForm(session, formData);
    const document = await issueFreeInvoice(session, {
      clientId,
      concept: requiredText(formData.get("concept"), "Concepto"),
      amount: moneyFromForm(formData.get("amount")),
      creditDays: optionalText(formData.get("creditDays")) ? Number(formData.get("creditDays")) : null,
      cfdiUse: parseCfdiUse(formData.get("cfdiUse")),
      paymentMethod: parsePaymentMethod(formData.get("paymentMethod")),
      paymentForm: parsePaymentForm(formData.get("paymentForm")),
    });
    await setFlash({ tone: "ok", message: `${document.folio} emitida como factura libre.` });
    redirect(`/facturacion/${document.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/facturacion/nuevo");
  }
}

async function guardDocumentDelivery(documentId: string) {
  const session = await requireCompany();
  if (
    !can(session.role, "invoice.request", session.activeCompanyCode)
    && !can(session.role, "invoice.issue", session.activeCompanyCode)
  ) {
    await setFlash({ tone: "error", message: "No tienes permiso para enviar este documento." });
    redirect(`/facturacion/${documentId}`);
  }
  if (session.role === "VENTAS") {
    const doc = await prisma.billingDocument.findFirst({
      where: { id: documentId, companyId: session.activeCompanyId },
      select: { client: { select: { ownerUserId: true } } },
    });
    if (!doc || doc.client.ownerUserId !== session.userId) {
      await setFlash({ tone: "error", message: "Ese documento pertenece a un cliente asignado a otro vendedor." });
      redirect("/facturacion");
    }
  }
  return session;
}

export async function sendBillingEmailAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  try {
    const session = await guardDocumentDelivery(id);
    const result = await sendBillingDocumentByEmail({
      companyId: session.activeCompanyId,
      documentId: id,
      toEmail: optionalText(formData.get("toEmail")),
      authorUserId: session.userId,
    });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function sendBillingWhatsAppAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  try {
    const session = await guardDocumentDelivery(id);
    const result = await sendBillingDocumentByWhatsApp({
      companyId: session.activeCompanyId,
      documentId: id,
      phone: optionalText(formData.get("phone")),
      authorUserId: session.userId,
    });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function requestCancelDocumentAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  try {
    const session = await requireCompany();
    if (billingSalesDetailReadOnly(session.role)) {
      throw new Error(billingSalesCannotMutateMessage());
    }
    if (
      !can(session.role, "invoice.request", session.activeCompanyCode)
      && !can(session.role, "invoice.issue", session.activeCompanyCode)
    ) {
      throw new Error("No tienes permiso para solicitar cancelación.");
    }
    await requestDocumentCancellation(session, id, {
      motive: requiredText(formData.get("motive"), "Motivo SAT"),
      substitutionDocId: optionalText(formData.get("substitutionDocId")),
    });
    await setFlash({ tone: "ok", message: "Solicitud de cancelación registrada. Requiere autorización de CEO o Administrador." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function authorizeCancelDocumentAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  try {
    const session = await guard("invoice.issue");
    await authorizeDocumentCancellation(session, id);
    await setFlash({ tone: "ok", message: "Cancelación autorizada. Ya se puede ejecutar ante el SAT." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function executeCancelDocumentAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  try {
    const session = await guard("invoice.issue");
    const result = await executeDocumentCancellation(session, id);
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function authorizeAndExecuteCancelAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  try {
    const session = await guard("invoice.issue");
    const result = await authorizeAndExecuteDocumentCancellation(session, id);
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function pollCancelStatusAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  try {
    const session = await guard("invoice.issue");
    const doc = await prisma.billingDocument.findFirst({
      where: { id, companyId: session.activeCompanyId },
      select: { id: true },
    });
    if (!doc) throw new Error("Documento no encontrado en esta empresa.");
    const result = await pollBillingDocumentCancellation(doc.id, { actorUserId: session.userId });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function updateBillingLineSatAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("documentId"), "Documento");
  const lineId = requiredText(formData.get("lineId"), "Línea");
  try {
    const session = await requireCompany();
    const mayIssue = can(session.role, "invoice.issue", session.activeCompanyCode);
    const mayRequest = can(session.role, "invoice.request", session.activeCompanyCode);
    if (!mayIssue && !mayRequest) {
      throw new Error("No tienes permiso para editar claves SAT.");
    }
    if (billingSalesDetailReadOnly(session.role)) {
      throw new Error(billingSalesCannotMutateMessage());
    }
    await patchBillingLineSatKeys(session, {
      documentId: id,
      lineId,
      satProductKey: requiredText(formData.get("satProductKey"), "Clave producto/servicio"),
      satUnitKey: requiredText(formData.get("satUnitKey"), "Clave unidad"),
    });
    await setFlash({ tone: "ok", message: "Claves SAT de la línea guardadas." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
  }
  redirect(`/facturacion/${id}`);
}

export async function issueCreditNoteAction(formData: FormData) {
  "use server";
  const targetDocumentId = requiredText(formData.get("targetDocumentId"), "Factura origen");
  try {
    const session = await guard("invoice.issue");
    const nc = await issueCreditNote(session, targetDocumentId, {
      concept: requiredText(formData.get("concept"), "Concepto"),
      amount: moneyFromForm(formData.get("amount"), "Importe"),
      cfdiUse: parseCfdiUse(formData.get("cfdiUse")) ?? "G02",
      paymentForm: parsePaymentForm(formData.get("paymentForm")),
    });
    await setFlash({ tone: "ok", message: `Nota de crédito ${nc.folio} emitida.` });
    redirect(`/facturacion/${nc.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/facturacion/${targetDocumentId}`);
  }
}
