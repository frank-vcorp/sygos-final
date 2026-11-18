import { ensureBillingDocumentArtifacts, safeFileBaseName } from "./billing-artifacts";
import { prisma } from "./db";
import { parseCompanyFiscalConfig } from "./fiscal-config";
import { recordHistory } from "./history";
import { money } from "./money";
import { can } from "./permissions";
import type { Role } from "./roles";
import { sendSystemEmail, type EmailAttachment } from "./sendgrid";
import { sendWhatsAppDocument } from "./whatsapp";

export type DownloadActorSession = {
  userId: string;
  role: Role;
  activeCompanyId: string | null;
  activeCompanyCode: string | null;
};

export type DownloadableDocumentAccess = {
  companyId: string;
  kind: string;
  clientOwnerUserId: string | null;
  payableCompanyId: string | null;
};

/**
 * Valida quién puede descargar XML/PDF/ZIP de un BillingDocument:
 * - Empresa emisora: roles con invoice.request, invoice.issue, receivable.view o finance.view
 *   (VENTAS solo clientes propios).
 * - Empresa receptora de FACTURA_INTERCOMPANIA (SYSTRON vía Payable ligado):
 *   roles con finance.view, receivable.view o invoice.issue (excluye VENTAS).
 */
export function canDownloadBillingDocument(
  session: DownloadActorSession | null,
  doc: DownloadableDocumentAccess,
): boolean {
  if (!session || !session.activeCompanyId) return false;
  const code = session.activeCompanyCode;
  if (doc.companyId === session.activeCompanyId) {
    if (session.role === "VENTAS") {
      return (
        can(session.role, "invoice.request", code)
        && doc.clientOwnerUserId === session.userId
      );
    }
    const hasPerm =
      can(session.role, "invoice.request", code)
      || can(session.role, "invoice.issue", code)
      || can(session.role, "receivable.view", code)
      || can(session.role, "finance.view", code);
    return hasPerm;
  }

  if (
    doc.kind === "FACTURA_INTERCOMPANIA"
    && doc.payableCompanyId === session.activeCompanyId
    && session.role !== "VENTAS"
  ) {
    return (
      can(session.role, "finance.view", code)
      || can(session.role, "receivable.view", code)
      || can(session.role, "invoice.issue", code)
    );
  }

  return false;
}

export function resolveBillingDocumentEmailRecipient(document: {
  client: {
    fiscalEmail?: string | null;
    contacts: Array<{ email?: string | null; isPrimary?: boolean }>;
  };
}): string | null {
  if (document.client.fiscalEmail?.trim()) return document.client.fiscalEmail.trim();
  const primary = document.client.contacts.find((c) => c.isPrimary && c.email?.trim());
  if (primary?.email?.trim()) return primary.email.trim();
  const anyEmail = document.client.contacts.find((c) => c.email?.trim());
  return anyEmail?.email?.trim() ?? null;
}

export function resolveBillingDocumentWhatsAppPhone(document: {
  client: {
    contacts: Array<{ phone?: string | null; isPrimary?: boolean }>;
  };
}): string | null {
  const primary = document.client.contacts.find((c) => c.isPrimary && c.phone?.trim());
  if (primary?.phone?.trim()) return primary.phone.trim();
  const anyPhone = document.client.contacts.find((c) => c.phone?.trim());
  return anyPhone?.phone?.trim() ?? null;
}

export async function sendBillingDocumentByEmail(input: {
  companyId: string;
  documentId: string;
  toEmail?: string | null;
  authorUserId?: string | null;
  fetchFn?: typeof fetch;
}): Promise<{ ok: boolean; message: string }> {
  const doc = await prisma.billingDocument.findFirst({
    where: { id: input.documentId, companyId: input.companyId },
    include: {
      company: true,
      client: {
        include: {
          contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        },
      },
    },
  });
  if (!doc) return { ok: false, message: "Documento no encontrado en esta empresa." };
  if (doc.kind === "REMISION") return { ok: false, message: "Una remisión no tiene CFDI XML/PDF." };
  if (doc.fiscalStatus !== "TIMBRADA" && !doc.xmlContent && !doc.fiscalExternalId) {
    return { ok: false, message: "El comprobante aún no está timbrado en Facturapi." };
  }

  const recipient = input.toEmail?.trim() || resolveBillingDocumentEmailRecipient(doc);
  if (!recipient) {
    return { ok: false, message: "El cliente no tiene correo fiscal ni de contacto capturado." };
  }

  const artifacts = await ensureBillingDocumentArtifacts(doc.id, { fetchFn: input.fetchFn });
  const base = safeFileBaseName(doc.folio);
  const attachments: EmailAttachment[] = [];
  if (artifacts.pdf && artifacts.pdf.length > 0) {
    attachments.push({ filename: `${base}.pdf`, content: artifacts.pdf, contentType: "application/pdf" });
  }
  if (artifacts.xml) {
    attachments.push({ filename: `${base}.xml`, content: Buffer.from(artifacts.xml, "utf8"), contentType: "application/xml" });
  }
  if (attachments.length === 0) {
    return { ok: false, message: "No fue posible obtener los archivos XML/PDF de Facturapi." };
  }

  const isTestEnv = doc.fiscalEnv === "TEST";
  const subject = `${isTestEnv ? "[PRUEBA SANDBOX] " : ""}Factura ${doc.folio} · ${doc.company.name}`;
  const text = [
    `Estimado(a) ${doc.client.name},`,
    "",
    `Adjuntamos los archivos de su comprobante fiscal ${doc.folio} por ${money(doc.total)}.`,
    doc.fiscalUuid ? `UUID fiscal: ${doc.fiscalUuid}` : null,
    isTestEnv ? "NOTA: Este documento se emitió en ambiente de pruebas (sin validez ante el SAT)." : null,
    "",
    `Atentamente,`,
    doc.company.name,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const result = await sendSystemEmail({
    companyId: doc.companyId,
    to: recipient,
    subject,
    text,
    attachments,
  });

  if (result.ok) {
    await recordHistory({
      companyId: doc.companyId,
      entityType: "DOCUMENTO",
      entityId: doc.id,
      action: "ENVIO_CORREO",
      summary: `CFDI ${doc.folio} (XML/PDF) enviado por correo a ${recipient}.`,
      authorUserId: input.authorUserId ?? null,
    });
  }

  return { ok: result.ok, message: result.message };
}

export async function sendBillingDocumentByWhatsApp(input: {
  companyId: string;
  documentId: string;
  phone?: string | null;
  authorUserId?: string | null;
  fetchFn?: typeof fetch;
}): Promise<{ ok: boolean; message: string }> {
  const doc = await prisma.billingDocument.findFirst({
    where: { id: input.documentId, companyId: input.companyId },
    include: {
      company: true,
      client: {
        include: {
          contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        },
      },
    },
  });
  if (!doc) return { ok: false, message: "Documento no encontrado en esta empresa." };
  if (doc.kind === "REMISION") return { ok: false, message: "Una remisión no tiene CFDI PDF." };
  if (doc.fiscalStatus !== "TIMBRADA" && !doc.pdfContent && !doc.fiscalExternalId) {
    return { ok: false, message: "El comprobante aún no está timbrado en Facturapi." };
  }

  const targetPhone = input.phone?.trim() || resolveBillingDocumentWhatsAppPhone(doc);
  if (!targetPhone) {
    return { ok: false, message: "El cliente no tiene teléfono de contacto para WhatsApp." };
  }

  const artifacts = await ensureBillingDocumentArtifacts(doc.id, { fetchFn: input.fetchFn });
  if (!artifacts.pdf || artifacts.pdf.length === 0) {
    return { ok: false, message: "No se pudo obtener el PDF del comprobante desde Facturapi." };
  }

  const base = safeFileBaseName(doc.folio);
  const isTestEnv = doc.fiscalEnv === "TEST";
  const caption = [
    `${isTestEnv ? "[PRUEBA SANDBOX] " : ""}Factura ${doc.folio} · ${doc.company.name}`,
    `Importe: ${money(doc.total)}`,
    doc.fiscalUuid ? `UUID: ${doc.fiscalUuid}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await sendWhatsAppDocument({
    companyId: doc.companyId,
    phone: targetPhone,
    document: artifacts.pdf,
    fileName: `${base}.pdf`,
    mimetype: "application/pdf",
    caption,
  });

  if (result.ok) {
    await recordHistory({
      companyId: doc.companyId,
      entityType: "DOCUMENTO",
      entityId: doc.id,
      action: "ENVIO_WHATSAPP",
      summary: `PDF de ${doc.folio} enviado por WhatsApp a ${targetPhone}.`,
      authorUserId: input.authorUserId ?? null,
    });
  }

  return { ok: result.ok, message: result.message };
}

export async function maybeAutoDeliverStampedDocument(
  documentId: string,
  options?: { fetchFn?: typeof fetch },
) {
  try {
    const doc = await prisma.billingDocument.findUnique({
      where: { id: documentId },
      include: { company: true },
    });
    if (!doc || doc.fiscalStatus !== "TIMBRADA" || doc.fiscalEnv === "SIMULATED") return;
    const config = parseCompanyFiscalConfig(doc.company);
    if (config.toggles.autoEmailOnStamp) {
      await sendBillingDocumentByEmail({
        companyId: doc.companyId,
        documentId: doc.id,
        fetchFn: options?.fetchFn,
      });
    }
  } catch {
    // Non-blocking: delivery failures never revert stamping
  }
}
