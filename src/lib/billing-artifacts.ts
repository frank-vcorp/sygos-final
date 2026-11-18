import { prisma } from "./db";
import { resolveFacturapiSecretForEnv } from "./fiscal-config";
import { buildZipBuffer } from "./zip";

const API = "https://www.facturapi.io/v2";

export async function fetchInvoiceFileFromFacturapi(
  secret: string,
  fiscalExternalId: string,
  format: "xml" | "pdf" | "zip",
  fetchFn: typeof fetch = fetch,
): Promise<Buffer | null> {
  try {
    const response = await fetchFn(`${API}/invoices/${encodeURIComponent(fiscalExternalId)}/${format}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export async function ensureBillingDocumentArtifacts(
  documentId: string,
  options?: { fetchFn?: typeof fetch },
): Promise<{
  folio: string;
  xml: string | null;
  pdf: Buffer | null;
}> {
  const fetchFn = options?.fetchFn ?? fetch;
  const doc = await prisma.billingDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      folio: true,
      companyId: true,
      kind: true,
      fiscalStatus: true,
      fiscalEnv: true,
      fiscalExternalId: true,
      xmlContent: true,
      pdfContent: true,
    },
  });
  if (!doc) {
    return { folio: "documento", xml: null, pdf: null };
  }

  let xml: string | null = doc.xmlContent ?? null;
  let pdf: Buffer | null = doc.pdfContent ? Buffer.from(doc.pdfContent) : null;

  const needsXml = !xml;
  const needsPdf = !pdf || pdf.length === 0;

  if (
    (needsXml || needsPdf)
    && doc.kind !== "REMISION"
    && doc.fiscalExternalId
    && doc.fiscalEnv !== "SIMULATED"
    && (doc.fiscalStatus === "TIMBRADA" || doc.fiscalStatus === "CANCELADA")
  ) {
    const cred = await resolveFacturapiSecretForEnv(doc.companyId, doc.fiscalEnv);
    if (cred) {
      const [fetchedXmlBuf, fetchedPdfBuf] = await Promise.all([
        needsXml ? fetchInvoiceFileFromFacturapi(cred.secret, doc.fiscalExternalId, "xml", fetchFn) : Promise.resolve(null),
        needsPdf ? fetchInvoiceFileFromFacturapi(cred.secret, doc.fiscalExternalId, "pdf", fetchFn) : Promise.resolve(null),
      ]);
      const nextXml = fetchedXmlBuf ? fetchedXmlBuf.toString("utf8") : null;
      const nextPdf = fetchedPdfBuf && fetchedPdfBuf.length > 0 ? fetchedPdfBuf : null;
      if (nextXml || nextPdf) {
        await prisma.billingDocument.update({
          where: { id: doc.id },
          data: {
            ...(nextXml ? { xmlContent: nextXml } : {}),
            ...(nextPdf ? { pdfContent: Uint8Array.from(nextPdf) } : {}),
          },
        });
      }
      if (nextXml) xml = nextXml;
      if (nextPdf) pdf = nextPdf;
    }
  }

  return { folio: doc.folio, xml, pdf };
}

export function safeFileBaseName(folio: string): string {
  return folio.replace(/[^a-zA-Z0-9._-]/g, "_") || "cfdi";
}

export async function getBillingDocumentDownload(
  documentId: string,
  format: "xml" | "pdf" | "zip",
  options?: { fetchFn?: typeof fetch },
): Promise<{
  filename: string;
  contentType: string;
  buffer: Buffer;
} | null> {
  const { folio, xml, pdf } = await ensureBillingDocumentArtifacts(documentId, options);
  const base = safeFileBaseName(folio);

  if (format === "xml") {
    if (!xml) return null;
    return {
      filename: `${base}.xml`,
      contentType: "application/xml; charset=utf-8",
      buffer: Buffer.from(xml, "utf8"),
    };
  }

  if (format === "pdf") {
    if (!pdf || pdf.length === 0) return null;
    return {
      filename: `${base}.pdf`,
      contentType: "application/pdf",
      buffer: pdf,
    };
  }

  // zip
  const entries: Array<{ name: string; content: Buffer }> = [];
  if (xml) entries.push({ name: `${base}.xml`, content: Buffer.from(xml, "utf8") });
  if (pdf && pdf.length > 0) entries.push({ name: `${base}.pdf`, content: pdf });

  if (entries.length === 2) {
    return {
      filename: `${base}.zip`,
      contentType: "application/zip",
      buffer: buildZipBuffer(entries),
    };
  }

  // Si falta alguno de los dos localmente, intenta /zip directo en Facturapi
  const doc = await prisma.billingDocument.findUnique({
    where: { id: documentId },
    select: { companyId: true, fiscalExternalId: true, fiscalEnv: true },
  });
  if (doc?.fiscalExternalId && doc.fiscalEnv !== "SIMULATED") {
    const cred = await resolveFacturapiSecretForEnv(doc.companyId, doc.fiscalEnv);
    if (cred) {
      const zipBuf = await fetchInvoiceFileFromFacturapi(
        cred.secret,
        doc.fiscalExternalId,
        "zip",
        options?.fetchFn ?? fetch,
      );
      if (zipBuf) {
        return {
          filename: `${base}.zip`,
          contentType: "application/zip",
          buffer: zipBuf,
        };
      }
    }
  }

  if (entries.length > 0) {
    return {
      filename: `${base}.zip`,
      contentType: "application/zip",
      buffer: buildZipBuffer(entries),
    };
  }
  return null;
}

export async function ensurePaymentComplementArtifacts(
  complementId: string,
  options?: { fetchFn?: typeof fetch },
): Promise<{
  folio: string;
  xml: string | null;
  pdf: Buffer | null;
}> {
  const fetchFn = options?.fetchFn ?? fetch;
  const rep = await prisma.paymentComplement.findUnique({
    where: { id: complementId },
    select: {
      id: true,
      companyId: true,
      fiscalStatus: true,
      fiscalEnv: true,
      fiscalExternalId: true,
      xmlContent: true,
      pdfContent: true,
      payment: { select: { folio: true } },
    },
  });
  if (!rep) {
    return { folio: "REP", xml: null, pdf: null };
  }

  const label = `REP-${rep.payment.folio}`;
  let xml: string | null = rep.xmlContent ?? null;
  let pdf: Buffer | null = rep.pdfContent ? Buffer.from(rep.pdfContent) : null;

  const needsXml = !xml;
  const needsPdf = !pdf || pdf.length === 0;

  if (
    (needsXml || needsPdf)
    && rep.fiscalExternalId
    && rep.fiscalEnv !== "SIMULATED"
    && (rep.fiscalStatus === "TIMBRADA" || rep.fiscalStatus === "CANCELADA")
  ) {
    const cred = await resolveFacturapiSecretForEnv(rep.companyId, rep.fiscalEnv);
    if (cred) {
      const [fetchedXmlBuf, fetchedPdfBuf] = await Promise.all([
        needsXml ? fetchInvoiceFileFromFacturapi(cred.secret, rep.fiscalExternalId, "xml", fetchFn) : Promise.resolve(null),
        needsPdf ? fetchInvoiceFileFromFacturapi(cred.secret, rep.fiscalExternalId, "pdf", fetchFn) : Promise.resolve(null),
      ]);
      const nextXml = fetchedXmlBuf ? fetchedXmlBuf.toString("utf8") : null;
      const nextPdf = fetchedPdfBuf && fetchedPdfBuf.length > 0 ? fetchedPdfBuf : null;
      if (nextXml || nextPdf) {
        await prisma.paymentComplement.update({
          where: { id: rep.id },
          data: {
            ...(nextXml ? { xmlContent: nextXml } : {}),
            ...(nextPdf ? { pdfContent: Uint8Array.from(nextPdf) } : {}),
          },
        });
      }
      if (nextXml) xml = nextXml;
      if (nextPdf) pdf = nextPdf;
    }
  }

  return { folio: label, xml, pdf };
}

export async function getPaymentComplementDownload(
  complementId: string,
  format: "xml" | "pdf" | "zip",
  options?: { fetchFn?: typeof fetch },
): Promise<{
  filename: string;
  contentType: string;
  buffer: Buffer;
} | null> {
  const { folio, xml, pdf } = await ensurePaymentComplementArtifacts(complementId, options);
  const base = safeFileBaseName(folio);

  if (format === "xml") {
    if (!xml) return null;
    return {
      filename: `${base}.xml`,
      contentType: "application/xml; charset=utf-8",
      buffer: Buffer.from(xml, "utf8"),
    };
  }

  if (format === "pdf") {
    if (!pdf || pdf.length === 0) return null;
    return {
      filename: `${base}.pdf`,
      contentType: "application/pdf",
      buffer: pdf,
    };
  }

  const entries: Array<{ name: string; content: Buffer }> = [];
  if (xml) entries.push({ name: `${base}.xml`, content: Buffer.from(xml, "utf8") });
  if (pdf && pdf.length > 0) entries.push({ name: `${base}.pdf`, content: pdf });

  if (entries.length === 2) {
    return {
      filename: `${base}.zip`,
      contentType: "application/zip",
      buffer: buildZipBuffer(entries),
    };
  }

  const rep = await prisma.paymentComplement.findUnique({
    where: { id: complementId },
    select: { companyId: true, fiscalExternalId: true, fiscalEnv: true },
  });
  if (rep?.fiscalExternalId && rep.fiscalEnv !== "SIMULATED") {
    const cred = await resolveFacturapiSecretForEnv(rep.companyId, rep.fiscalEnv);
    if (cred) {
      const zipBuf = await fetchInvoiceFileFromFacturapi(
        cred.secret,
        rep.fiscalExternalId,
        "zip",
        options?.fetchFn ?? fetch,
      );
      if (zipBuf) {
        return {
          filename: `${base}.zip`,
          contentType: "application/zip",
          buffer: zipBuf,
        };
      }
    }
  }

  if (entries.length > 0) {
    return {
      filename: `${base}.zip`,
      contentType: "application/zip",
      buffer: buildZipBuffer(entries),
    };
  }
  return null;
}
