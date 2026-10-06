"use server";

import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { optionalText, requiredText } from "@/lib/form";
import { can, type Action } from "@/lib/permissions";
import { issueDocument, issueFreeInvoice, requestFromQuote, requestIntercompany, retryFiscal } from "@/lib/billing";
import { requireCompany } from "@/lib/session";

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
    redirect(`/facturacion/${document.id}`);
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
    redirect(`/facturacion/${document.id}`);
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
    await issueDocument(session, id);
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
    await retryFiscal(session, id);
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
    const document = await issueFreeInvoice(session, {
      clientId: requiredText(formData.get("clientId"), "Cliente"),
      concept: requiredText(formData.get("concept"), "Concepto"),
      amount: Number(formData.get("amount")),
      creditDays: optionalText(formData.get("creditDays")) ? Number(formData.get("creditDays")) : null,
    });
    await setFlash({ tone: "ok", message: `${document.folio} emitida como factura libre.` });
    redirect(`/facturacion/${document.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect("/facturacion/nuevo");
  }
}
