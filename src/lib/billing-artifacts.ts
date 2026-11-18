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

export async function fetchCancellationReceiptFromFacturapi(
  secret: string,
  fiscalExternalId: string,
  format: "xml" | "pdf",
  fetchFn: typeof fetch = fetch,
): Promise<Buffer | null> {
  try {
    const response = await fetchFn(
      `${API}/invoices/${encodeURIComponent(fiscalExternalId)}/cancellation_receipt/${format}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!response.ok) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export async function ensureCancellationReceiptArtifacts(
  documentId: string,
  options?: { fetchFn?: typeof fetch },
): Promise<{ folio: string; xml: string | null; pdf: Buffer | null }> {
  const fetchFn = options?.fetchFn ?? fetch;
  const doc = await prisma.billingDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      folio: true,
      companyId: true,
      fiscalEnv: true,
      fiscalExternalId: true,
      cancellationStatus: true,
      cancelReceiptXml: true,
      cancelReceiptPdf: true,
    },
  });
  if (!doc) return { folio: "acuse", xml: null, pdf: null };

  let xml: string | null = doc.cancelReceiptXml ?? null;
  let pdf: Buffer | null = doc.cancelReceiptPdf ? Buffer.from(doc.cancelReceiptPdf) : null;

  if (
    (!xml || !pdf)
    && doc.fiscalExternalId
    && doc.fiscalEnv !== "SIMULATED"
    && (doc.cancellationStatus === "accepted" || doc.cancellationStatus === "pending" || doc.cancellationStatus === "verifying")
  ) {
    const cred = await resolveFacturapiSecretForEnv(doc.companyId, doc.fiscalEnv);
    if (cred) {
      const [xmlBuf, pdfBuf] = await Promise.all([
        !xml ? fetchCancellationReceiptFromFacturapi(cred.secret, doc.fiscalExternalId, "xml", fetchFn) : Promise.resolve(null),
        !pdf ? fetchCancellationReceiptFromFacturapi(cred.secret, doc.fiscalExternalId, "pdf", fetchFn) : Promise.resolve(null),
      ]);
      const nextXml = xmlBuf ? xmlBuf.toString("utf8") : null;
      const nextPdf = pdfBuf && pdfBuf.length > 0 ? pdfBuf : null;
      if (nextXml || nextPdf) {
        await prisma.billingDocument.update({
          where: { id: doc.id },
          data: {
            ...(nextXml ? { cancelReceiptXml: nextXml } : {}),
            ...(nextPdf ? { cancelReceiptPdf: Uint8Array.from(nextPdf) } : {}),
          },
        });
      }
      if (nextXml) xml = nextXml;
      if (nextPdf) pdf = nextPdf;
    }
  }

  return { folio: doc.folio, xml, pdf };
}

export async function getCancellationReceiptDownload(
  documentId: string,
  format: "xml" | "pdf",
  options?: { fetchFn?: typeof fetch },
): Promise<{ filename: string; contentType: string; buffer: Buffer } | null> {
  const { folio, xml, pdf } = await ensureCancellationReceiptArtifacts(documentId, options);
  const base = `${safeFileBaseName(folio)}-acuse-cancelacion`;
  if (format === "xml") {
    if (!xml) return null;
    return {
      filename: `${base}.xml`,
      contentType: "application/xml; charset=utf-8",
      buffer: Buffer.from(xml, "utf8"),
    };
  }
  if (!pdf || pdf.length === 0) return null;
  return {
    filename: `${base}.pdf`,
    contentType: "application/pdf",
    buffer: pdf,
  };
}

export async function ensureRepCancellationReceiptArtifacts(
  complementId: string,
  options?: { fetchFn?: typeof fetch },
): Promise<{ xml: string | null; pdf: Buffer | null }> {
  const fetchFn = options?.fetchFn ?? fetch;
  const rep = await prisma.paymentComplement.findUnique({
    where: { id: complementId },
    select: {
      id: true,
      companyId: true,
      fiscalEnv: true,
      fiscalExternalId: true,
      cancellationStatus: true,
      cancelReceiptXml: true,
      cancelReceiptPdf: true,
    },
  });
  if (!rep) return { xml: null, pdf: null };

  let xml: string | null = rep.cancelReceiptXml ?? null;
  let pdf: Buffer | null = rep.cancelReceiptPdf ? Buffer.from(rep.cancelReceiptPdf) : null;

  if (
    (!xml || !pdf)
    && rep.fiscalExternalId
    && rep.fiscalEnv !== "SIMULATED"
    && (rep.cancellationStatus === "accepted" || rep.cancellationStatus === "pending" || rep.cancellationStatus === "verifying")
  ) {
    const cred = await resolveFacturapiSecretForEnv(rep.companyId, rep.fiscalEnv);
    if (cred) {
      const [xmlBuf, pdfBuf] = await Promise.all([
        !xml ? fetchCancellationReceiptFromFacturapi(cred.secret, rep.fiscalExternalId, "xml", fetchFn) : Promise.resolve(null),
        !pdf ? fetchCancellationReceiptFromFacturapi(cred.secret, rep.fiscalExternalId, "pdf", fetchFn) : Promise.resolve(null),
      ]);
      const nextXml = xmlBuf ? xmlBuf.toString("utf8") : null;
      const nextPdf = pdfBuf && pdfBuf.length > 0 ? pdfBuf : null;
      if (nextXml || nextPdf) {
        await prisma.paymentComplement.update({
          where: { id: rep.id },
          data: {
            ...(nextXml ? { cancelReceiptXml: nextXml } : {}),
            ...(nextPdf ? { cancelReceiptPdf: Uint8Array.from(nextPdf) } : {}),
          },
        });
      }
      if (nextXml) xml = nextXml;
      if (nextPdf) pdf = nextPdf;
    }
  }

  return { xml, pdf };
}

export async function ensurePayrollLineArtifacts(
  lineId: string,
  options?: { fetchFn?: typeof fetch },
): Promise<{
  label: string;
  xml: string | null;
  pdf: Buffer | null;
}> {
  const fetchFn = options?.fetchFn ?? fetch;
  const line = await prisma.payrollLine.findUnique({
    where: { id: lineId },
    select: {
      id: true,
      fiscalStatus: true,
      fiscalEnv: true,
      fiscalExternalId: true,
      xmlContent: true,
      pdfContent: true,
      period: { select: { folio: true, companyId: true } },
      collaborator: { select: { user: { select: { name: true } } } },
    },
  });
  if (!line) {
    return { label: "recibo-nomina", xml: null, pdf: null };
  }

  const label = `${line.period.folio}-${line.collaborator.user.name}`;
  let xml: string | null = line.xmlContent ?? null;
  let pdf: Buffer | null = line.pdfContent ? Buffer.from(line.pdfContent) : null;

  const needsXml = !xml;
  const needsPdf = !pdf || pdf.length === 0;

  if (
    (needsXml || needsPdf)
    && line.fiscalExternalId
    && line.fiscalEnv !== "SIMULATED"
    && (line.fiscalStatus === "TIMBRADA" || line.fiscalStatus === "CANCELADA")
  ) {
    const cred = await resolveFacturapiSecretForEnv(line.period.companyId, line.fiscalEnv);
    if (cred) {
      const [fetchedXmlBuf, fetchedPdfBuf] = await Promise.all([
        needsXml ? fetchInvoiceFileFromFacturapi(cred.secret, line.fiscalExternalId, "xml", fetchFn) : Promise.resolve(null),
        needsPdf ? fetchInvoiceFileFromFacturapi(cred.secret, line.fiscalExternalId, "pdf", fetchFn) : Promise.resolve(null),
      ]);
      const nextXml = fetchedXmlBuf ? fetchedXmlBuf.toString("utf8") : null;
      const nextPdf = fetchedPdfBuf && fetchedPdfBuf.length > 0 ? fetchedPdfBuf : null;
      if (nextXml || nextPdf) {
        await prisma.payrollLine.update({
          where: { id: line.id },
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

  return { label, xml, pdf };
}

export async function getPayrollLineDownload(
  lineId: string,
  format: "xml" | "pdf" | "zip",
  options?: { fetchFn?: typeof fetch },
): Promise<{ filename: string; contentType: string; buffer: Buffer } | null> {
  const { label, xml, pdf } = await ensurePayrollLineArtifacts(lineId, options);
  const base = safeFileBaseName(label);

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

  const line = await prisma.payrollLine.findUnique({
    where: { id: lineId },
    select: { fiscalExternalId: true, fiscalEnv: true, period: { select: { companyId: true } } },
  });
  if (line?.fiscalExternalId && line.fiscalEnv !== "SIMULATED") {
    const cred = await resolveFacturapiSecretForEnv(line.period.companyId, line.fiscalEnv);
    if (cred) {
      const zipBuf = await fetchInvoiceFileFromFacturapi(
        cred.secret,
        line.fiscalExternalId,
        "zip",
        options?.fetchFn ?? fetch,
      );
      if (zipBuf) {
        return { filename: `${base}.zip`, contentType: "application/zip", buffer: zipBuf };
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

export async function getPayrollPeriodZipDownload(
  periodId: string,
  options?: { fetchFn?: typeof fetch },
): Promise<{ filename: string; contentType: string; buffer: Buffer } | null> {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: {
      lines: {
        include: { collaborator: { include: { user: { select: { name: true } } } } },
        orderBy: { collaborator: { user: { name: "asc" } } },
      },
    },
  });
  if (!period) return null;

  const entries: Array<{ name: string; content: Buffer }> = [];
  for (const line of period.lines) {
    if (line.fiscalStatus !== "TIMBRADA" && !line.xmlContent && !line.pdfContent) continue;
    const { xml, pdf } = await ensurePayrollLineArtifacts(line.id, options);
    const lineBase = safeFileBaseName(`${period.folio}-${line.collaborator.user.name}`);
    if (pdf && pdf.length > 0) entries.push({ name: `${lineBase}.pdf`, content: pdf });
    if (xml) entries.push({ name: `${lineBase}.xml`, content: Buffer.from(xml, "utf8") });
  }
  if (entries.length === 0) return null;

  return {
    filename: `${safeFileBaseName(period.folio)}-cfdi.zip`,
    contentType: "application/zip",
    buffer: buildZipBuffer(entries),
  };
}
