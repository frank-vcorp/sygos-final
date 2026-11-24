"use server";

import { redirect } from "next/navigation";
import {
  parseEmailRecipients,
  parsePhoneRecipients,
  quoteDeliveryDefaultMessages,
  sendEmailsToMany,
  sendWhatsAppToMany,
} from "@/lib/document-delivery";
import { setFlash } from "@/lib/flash";
import { optionalText, requiredText } from "@/lib/form";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { requireCompany } from "@/lib/session";

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}

function returnTo(formData: FormData) {
  const path = String(formData.get("returnTo") ?? "").trim();
  if (path.startsWith("/")) return path;
  const quoteId = String(formData.get("quoteId") ?? "").trim();
  return quoteId ? `/cotizaciones/${quoteId}` : "/cotizaciones";
}

async function guardQuoteFollow() {
  const session = await requireCompany();
  if (!can(session.role, "quote.follow", session.activeCompanyCode)) {
    await setFlash({ tone: "error", message: "No tienes permiso para enviar esta cotización." });
    redirect("/cotizaciones");
  }
  return session;
}

async function loadQuote(quoteId: string, companyId: string) {
  return prisma.quote.findFirst({
    where: { id: quoteId, companyId },
    include: { client: true, company: true },
  });
}

export async function sendQuoteDeliveryEmailAction(formData: FormData) {
  const target = returnTo(formData);
  try {
    const session = await guardQuoteFollow();
    const quoteId = requiredText(formData.get("quoteId"), "Cotización");
    const quote = await loadQuote(quoteId, session.activeCompanyId);
    if (!quote) throw new Error("Esa cotización no es de esta empresa.");

    const recipients = parseEmailRecipients(formData);
    if (recipients.length === 0) throw new Error("Selecciona al menos un correo destinatario.");

    const defaults = quoteDeliveryDefaultMessages(quote);
    const subject = optionalText(formData.get("subject"))?.trim() || defaults.subject;
    const customBody = optionalText(formData.get("body"))?.trim();
    const text = customBody || defaults.emailBody;

    const result = await sendEmailsToMany({
      companyId: session.activeCompanyId,
      recipients,
      subject,
      text,
    });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo enviar el correo." });
  }
  redirect(target);
}

export async function sendQuoteDeliveryWhatsAppAction(formData: FormData) {
  const target = returnTo(formData);
  try {
    const session = await guardQuoteFollow();
    const quoteId = requiredText(formData.get("quoteId"), "Cotización");
    const quote = await loadQuote(quoteId, session.activeCompanyId);
    if (!quote) throw new Error("Esa cotización no es de esta empresa.");

    const recipients = parsePhoneRecipients(formData);
    if (recipients.length === 0) throw new Error("Selecciona al menos un número de WhatsApp.");

    const defaults = quoteDeliveryDefaultMessages(quote);
    const customBody = optionalText(formData.get("whatsAppBody"))?.trim();
    const text = customBody || defaults.waBody;

    const result = await sendWhatsAppToMany({
      companyId: session.activeCompanyId,
      recipients,
      text,
    });
    await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo enviar por WhatsApp." });
  }
  redirect(target);
}