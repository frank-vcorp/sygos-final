import type { SendGridSmtpConfig } from "./sendgrid";
import { quoteDeliveryEmailNote } from "./quotes";
import type { WhatsAppState } from "./whatsapp";

export type DocumentDeliveryContact = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
};

export type DeliveryIntegrationHint = {
  ready: boolean;
  message: string;
};

export type MultiSendResult = {
  ok: boolean;
  message: string;
  sent: number;
  failed: number;
};

const LIST_SPLIT = /[,;]+/;
const EMAIL_EXTRA_SPLIT = /[,;\s]+/;

export function parseEmailRecipients(formData: FormData, fieldPrefix = "contactEmail"): string[] {
  const selected = formData
    .getAll(fieldPrefix)
    .map((value) => String(value).trim().toLowerCase())
    .filter((value) => value.includes("@"));
  const extra = String(formData.get("extraEmail") ?? "").trim();
  const set = new Set<string>(selected);
  if (extra) {
    for (const part of extra.split(EMAIL_EXTRA_SPLIT)) {
      const normalized = part.trim().toLowerCase();
      if (normalized.includes("@")) set.add(normalized);
    }
  }
  return [...set];
}

export function parsePhoneRecipients(formData: FormData, fieldPrefix = "contactPhone"): string[] {
  const selected = formData
    .getAll(fieldPrefix)
    .map((value) => String(value).trim())
    .filter((value) => value.replace(/\D/g, "").length >= 10);
  const extra = String(formData.get("extraPhone") ?? "").trim();
  const set = new Set<string>(selected);
  if (extra) {
    const chunks = extra.includes(",") || extra.includes(";")
      ? extra.split(LIST_SPLIT).map((p) => p.trim())
      : [extra.trim()];
    for (const normalized of chunks) {
      if (normalized.replace(/\D/g, "").length >= 10) set.add(normalized);
    }
  }
  return [...set];
}

export function contactOptionsForDelivery(contacts: DocumentDeliveryContact[]) {
  return contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    email: contact.email?.trim() || null,
    phone: contact.phone?.trim() || null,
    isPrimary: Boolean(contact.isPrimary),
  }));
}

export function deliveryIntegrationFromConfig(
  sendGrid: SendGridSmtpConfig,
  whatsApp: WhatsAppState,
): { email: DeliveryIntegrationHint; whatsapp: DeliveryIntegrationHint } {
  let emailMessage = "Correo disponible.";
  let emailReady = true;
  if (!sendGrid.secret) {
    emailReady = false;
    emailMessage = "SendGrid sin API key. Configúralo en Integraciones.";
  } else if (!sendGrid.fromEmail) {
    emailReady = false;
    emailMessage = "Falta el correo remitente verificado en SendGrid.";
  } else if (!sendGrid.enabled) {
    emailReady = false;
    emailMessage = "El envío por correo está deshabilitado en Configuración.";
  }

  let whatsappMessage = "WhatsApp disponible.";
  let whatsappReady = true;
  if (!whatsApp.enabled) {
    whatsappReady = false;
    whatsappMessage = "WhatsApp (Baileys) está deshabilitado en Configuración.";
  } else if (whatsApp.state !== "vinculado") {
    whatsappReady = false;
    whatsappMessage =
      whatsApp.state === "esperando"
        ? "Escanea el QR en Integraciones para vincular WhatsApp."
        : "WhatsApp no está vinculado. Vincula el dispositivo en Configuración.";
  }

  return {
    email: { ready: emailReady, message: emailMessage },
    whatsapp: { ready: whatsappReady, message: whatsappMessage },
  };
}

export function summarizeMultiSend(results: Array<{ target: string; ok: boolean; message: string }>): MultiSendResult {
  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  if (results.length === 0) {
    return { ok: false, message: "Selecciona al menos un destinatario.", sent: 0, failed: 0 };
  }
  if (failed === 0) {
    return { ok: true, message: `Enviado a ${sent} destinatario${sent === 1 ? "" : "s"}.`, sent, failed };
  }
  if (sent === 0) {
    const detail = results.map((r) => `${r.target}: ${r.message}`).join(" · ");
    return { ok: false, message: detail, sent, failed };
  }
  const failures = results.filter((r) => !r.ok).map((r) => r.target).join(", ");
  return {
    ok: true,
    message: `Enviado a ${sent}; falló para: ${failures}.`,
    sent,
    failed,
  };
}

export function quoteDeliveryDefaultMessages(quote: {
  id: string;
  folio: string;
  company: { name: string };
  quoteType: string;
  technicalCaseId: string | null;
  slaDueAt: Date | null;
  deliveryBusinessDays: number | null;
}) {
  const subject = `${quote.folio} · ${quote.company.name}`;
  const docLink = documentPublicUrl(`/documentos/cotizacion/${quote.id}`);
  const note = quoteDeliveryEmailNote(quote);
  const emailBody = [
    `Cotización ${quote.folio} de ${quote.company.name}.${note}`,
    docLink ? `\nConsulta el documento: ${docLink}` : "\nAbre la cotización en SYGOS para ver el formato imprimible.",
  ].join("");
  const waBody = [
    `Hola, le comparto la cotización ${quote.folio} de ${quote.company.name}.${note}`,
    docLink ? ` Puede verla aquí: ${docLink}` : "",
  ].join("");
  return { subject, emailBody, waBody };
}

export function documentPublicUrl(path: string): string | null {
  const base = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!base) return null;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/$/, "")}${normalizedPath}`;
}