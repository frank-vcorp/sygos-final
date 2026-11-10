import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { allocateFolio, serviceFolioForAttention } from "./folios";
import { recordCompanyCash } from "./purchases";
import { stampBillingDocument } from "./facturapi";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { linesForTotal, quoteTotals, roundMoney } from "./money";
import type { Role } from "./roles";
import { SALES_NOT_ASSIGNED_MESSAGE } from "./sales-assignment";

type Actor = { userId: string; role: Role; activeCompanyId: string; activeCompanyCode: string };

const CASH_INVOICE_LIMIT = 2000;
const INTERCOMPANY_KIND = "FACTURA_INTERCOMPANIA";
const INTERCOMPANY_SUPPLIER_ID = "supplier-intercompany-servomotores";
const MIN_INTERCOMPANY_CFDI_USE = "G03";
const MIN_INTERCOMPANY_PAYMENT_METHOD = "PPD";

export function cashAllowedOnInvoice(amount: number, requiresInvoice: boolean | null): boolean {
  if (requiresInvoice !== true) return true;
  return amount < CASH_INVOICE_LIMIT;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function balanceStatus(balance: number, amount: number) {
  if (balance <= 0) return "SALDADA";
  if (balance < amount) return "PARCIAL";
  return "ABIERTA";
}

async function invoicedTotal(quoteId: string) {
  const rows = await prisma.billingDocument.findMany({
    where: { quoteId, status: { in: ["SOLICITADA", "EMITIDA", "ERROR_FISCAL"] } },
  });
  return roundMoney(rows.reduce((sum, row) => sum + row.total, 0));
}

async function invoicedTotalForFieldService(fieldServiceCaseId: string) {
  const rows = await prisma.billingDocument.findMany({
    where: { fieldServiceCaseId, status: { in: ["SOLICITADA", "EMITIDA", "ERROR_FISCAL"] } },
  });
  return roundMoney(rows.reduce((sum, row) => sum + row.total, 0));
}

async function assertAtMostOneServiceInvoice(attentionId: string, kind: "FACTURA" | "REMISION") {
  if (kind !== "FACTURA") return;
  const caseIds = (
    await prisma.technicalCase.findMany({ where: { attentionId }, select: { id: true } })
  ).map((row) => row.id);
  if (caseIds.length === 0) return;
  const quoteIds = (
    await prisma.quote.findMany({ where: { technicalCaseId: { in: caseIds } }, select: { id: true } })
  ).map((row) => row.id);
  const existing = await prisma.billingDocument.findFirst({
    where: {
      kind: "FACTURA",
      status: { in: ["SOLICITADA", "EMITIDA", "ERROR_FISCAL"] },
      OR: [
        { technicalCaseId: { in: caseIds } },
        ...(quoteIds.length > 0 ? [{ quoteId: { in: quoteIds } }] : []),
      ],
    },
  });
  if (existing) throw new Error("Este servicio ya tiene una factura; no se permite otra FAC ligada a la atención.");
}

async function serviceBillingFolio(
  attentionId: string,
  companyId: string,
  kind: "FACTURA" | "REMISION",
): Promise<string> {
  const series = kind === "REMISION" ? "REM" : "FAC";
  return serviceFolioForAttention(attentionId, companyId, series);
}

export async function requestFromQuote(actor: Actor, quoteId: string, kind: "FACTURA" | "REMISION", amount: number | null) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId },
    include: { lines: true, client: true, fieldServiceCase: true },
  });
  if (!quote || quote.status !== "AUTORIZADA") throw new Error("Solo se solicita documento de una cotización autorizada.");
  if (quote.quoteType === "CAMPO") {
    if (!quote.fieldServiceCase) throw new Error("La cotización de campo aún no tiene un SCA; autoriza y confirma el caso en servicio de campo.");
    return requestFromFieldServiceCase(actor, quote.fieldServiceCase.id, kind, amount);
  }
  if (actor.role === "VENTAS" && quote.sellerUserId !== actor.userId) throw new Error(SALES_NOT_ASSIGNED_MESSAGE);
  if (quote.client.requiresInvoice === true && kind === "REMISION") {
    throw new Error("Este cliente requiere factura (CFDI).");
  }
  if (quote.client.requiresInvoice !== true && kind === "FACTURA") {
    throw new Error("Este cliente no está marcado como que requiere factura; usa remisión.");
  }
  if (quote.technicalCaseId && kind === "FACTURA") {
    const linkedCase = await prisma.technicalCase.findUnique({
      where: { id: quote.technicalCaseId },
      select: { attentionId: true },
    });
    if (!linkedCase) throw new Error("No se encontró la operación ligada a la cotización.");
    await assertAtMostOneServiceInvoice(linkedCase.attentionId, kind);
  }
  const totals = quoteTotals(linesForTotal(quote.lines, quote.quoteType, quote.status), quote.discountPct);
  if (!totals) throw new Error("La cotización no tiene importe.");
  const used = await invoicedTotal(quote.id);
  const remaining = roundMoney(totals.total - used);
  if (remaining <= 0 && kind === "FACTURA") throw new Error("Esa operación ya no tiene saldo por facturar.");
  const total = kind === "REMISION" && (amount == null || amount === 0) ? 0 : roundMoney(amount ?? remaining);
  if (kind === "FACTURA" && (total <= 0 || total > remaining)) throw new Error("El importe no puede exceder el saldo permitido.");
  if (kind === "FACTURA" && quote.linkedQuoteId && !quote.client.isSystem) {
    await issueServomotoresInvoiceForEndClientRequest(actor, quote.linkedQuoteId);
  }
  const ratio = totals.total === 0 ? 0 : total / totals.total;
  const subtotal = roundMoney(totals.subtotal * ratio);
  const iva = roundMoney(total - subtotal);
  let folio: string;
  if (quote.technicalCaseId) {
    const linkedCase = await prisma.technicalCase.findUnique({
      where: { id: quote.technicalCaseId },
      select: { attentionId: true },
    });
    if (!linkedCase) throw new Error("No se encontró la operación ligada a la cotización.");
    folio = await serviceBillingFolio(linkedCase.attentionId, actor.activeCompanyId, kind);
  } else {
    folio = await allocateFolio(actor.activeCompanyId, kind === "REMISION" ? "REM" : "FAC");
  }
  const concept = quote.lines.filter((line) => line.authorized || quote.quoteType !== "VENTA_EQUIPO").map((line) => line.concept).join("; ") || quote.folio;
  try {
    const document = await prisma.billingDocument.create({
      data: {
        folio,
        companyId: actor.activeCompanyId,
        kind,
        status: "SOLICITADA",
        clientId: quote.clientId,
        quoteId: quote.id,
        technicalCaseId: quote.technicalCaseId,
        equipmentId: quote.equipmentId,
        concept,
        subtotal,
        iva,
        total,
        creditDays: quote.creditDays ?? quote.client.creditDays ?? 0,
        rfcSnapshot: quote.client.rfc,
        fiscalStatus: kind === "REMISION" ? "NO_APLICA" : "PENDIENTE",
        requestedByUserId: actor.userId,
        lines: { create: [{ concept, quantity: 1, unitPrice: total, amount: total }] },
      },
    });
    await recordHistory({
      companyId: actor.activeCompanyId,
      entityType: "DOCUMENTO",
      entityId: document.id,
      action: "SOLICITUD",
      summary: `${folio} quedó solicitado. Coordinación emite el documento.`,
      authorUserId: actor.userId,
    });
    return document;
  } catch (error) {
    if (!isPrismaUnique(error)) throw error;
    const existing = await prisma.billingDocument.findFirst({
      where: { companyId: actor.activeCompanyId, folio, quoteId: quote.id, status: { not: "CANCELADA" } },
    });
    if (existing) return existing;
    throw new Error(kind === "FACTURA"
      ? "Este servicio ya tiene una factura; no se permite otra FAC ligada a la atención."
      : "No se pudo solicitar el documento.");
  }
}

/** Facturación de servicio de campo (SCA): folio FAC/REM global de empresa, ligado al SCA (no ciclo SRV). */
export async function requestFromFieldServiceCase(
  actor: Actor,
  fieldServiceCaseId: string,
  kind: "FACTURA" | "REMISION",
  amount: number | null,
) {
  const row = await prisma.fieldServiceCase.findFirst({
    where: { id: fieldServiceCaseId, companyId: actor.activeCompanyId },
    include: { client: true, quote: { include: { lines: true } } },
  });
  if (!row) throw new Error("No se encontró el servicio de campo.");
  if (row.quote.status !== "AUTORIZADA") throw new Error("La cotización COTSC debe estar autorizada.");
  if (actor.role === "VENTAS" && row.sellerUserId !== actor.userId) throw new Error(SALES_NOT_ASSIGNED_MESSAGE);
  if (row.client.requiresInvoice === true && kind === "REMISION") {
    throw new Error("Este cliente requiere factura (CFDI).");
  }
  if (row.client.requiresInvoice !== true && kind === "FACTURA") {
    throw new Error("Este cliente no está marcado como que requiere factura; usa remisión.");
  }
  const serviceTotal = roundMoney(row.hours * row.unitPrice);
  if (serviceTotal <= 0) throw new Error("El servicio de campo no tiene importe facturable.");
  const existingFac = await prisma.billingDocument.findFirst({
    where: {
      fieldServiceCaseId: row.id,
      kind: "FACTURA",
      status: { in: ["SOLICITADA", "EMITIDA", "ERROR_FISCAL"] },
    },
  });
  if (kind === "FACTURA" && existingFac) {
    throw new Error("Este SCA ya tiene una factura; no se permite otra FAC ligada al caso.");
  }
  const used = await invoicedTotalForFieldService(row.id);
  const remaining = roundMoney(serviceTotal - used);
  if (remaining <= 0 && kind === "FACTURA") throw new Error("Ese servicio de campo ya no tiene saldo por facturar.");
  const total = kind === "REMISION" && (amount == null || amount === 0) ? 0 : roundMoney(amount ?? remaining);
  if (kind === "FACTURA" && (total <= 0 || total > remaining)) throw new Error("El importe no puede exceder el saldo permitido.");
  const subtotal = roundMoney(total / 1.16);
  const iva = roundMoney(total - subtotal);
  const folio = await allocateFolio(actor.activeCompanyId, kind === "REMISION" ? "REM" : "FAC");
  const concept = `${row.concept} · ${row.folio}${row.description.trim() ? `: ${row.description.trim()}` : ""}`;
  const document = await prisma.billingDocument.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      kind,
      status: "SOLICITADA",
      clientId: row.clientId,
      quoteId: row.quoteId,
      fieldServiceCaseId: row.id,
      concept,
      subtotal,
      iva,
      total,
      creditDays: row.quote.creditDays ?? row.client.creditDays ?? 0,
      rfcSnapshot: row.client.rfc,
      fiscalStatus: kind === "REMISION" ? "NO_APLICA" : "PENDIENTE",
      requestedByUserId: actor.userId,
      lines: { create: [{ concept, quantity: 1, unitPrice: total, amount: total }] },
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: document.id,
    action: "SOLICITUD",
    summary: `${folio} quedó solicitado para ${row.folio}. Coordinación emite el documento.`,
    authorUserId: actor.userId,
  });
  return document;
}

export async function requestFromDiagnosisNoRepair(actor: Actor, diagnosisCaseId: string) {
  const row = await prisma.technicalCase.findFirst({
    where: { id: diagnosisCaseId, serviceCompanyId: actor.activeCompanyId, kind: "DIAGNOSTICO" },
    include: {
      attention: true,
      equipment: { include: { client: true } },
    },
  });
  if (!row?.noRepairAt) throw new Error("Este diagnóstico no está marcado como sin reparación.");
  if (row.status !== "VALIDADO") throw new Error("La solicitud de facturación aplica tras validar el diagnóstico.");
  const amount = row.attention.priorityPrice;
  if (amount == null || amount <= 0) {
    throw new Error("La prioridad normal no genera cobro por diagnóstico sin reparación.");
  }
  const existing = await prisma.billingDocument.findFirst({
    where: {
      technicalCaseId: row.id,
      status: { in: ["SOLICITADA", "EMITIDA", "ERROR_FISCAL"] },
    },
  });
  if (existing) return existing;

  const client = row.equipment.client;
  const kind: "FACTURA" | "REMISION" = client.requiresInvoice === true ? "FACTURA" : "REMISION";
  if (client.requiresInvoice === true && kind === "REMISION") {
    throw new Error("Este cliente requiere factura (CFDI).");
  }
  await assertAtMostOneServiceInvoice(row.attentionId, kind);
  const total = roundMoney(amount);
  const subtotal = roundMoney(total / 1.16);
  const iva = roundMoney(total - subtotal);
  const folio = await serviceBillingFolio(row.attentionId, actor.activeCompanyId, kind);
  const concept = "DX sin reparación";
  const document = await prisma.billingDocument.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      kind,
      status: "SOLICITADA",
      clientId: client.id,
      technicalCaseId: row.id,
      equipmentId: row.equipmentId,
      concept,
      subtotal,
      iva,
      total,
      creditDays: client.creditDays ?? 0,
      rfcSnapshot: client.rfc,
      fiscalStatus: kind === "REMISION" ? "NO_APLICA" : "PENDIENTE",
      requestedByUserId: actor.userId,
      lines: { create: [{ concept, quantity: 1, unitPrice: total, amount: total }] },
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: document.id,
    action: "SOLICITUD",
    summary: `${folio} solicitado por prioridad ${row.attention.priorityName} (DX sin reparación).`,
    authorUserId: actor.userId,
  });
  return document;
}

export type DocumentFiscalOverrides = { cfdiUse: string | null; paymentMethod: string | null };

function fiscalForDocument(
  client: { cfdiUse: string | null; paymentMethod: string | null },
  overrides?: DocumentFiscalOverrides,
): { cfdiUse: string; paymentMethod: string } {
  const cfdiUse = overrides?.cfdiUse ?? client.cfdiUse;
  const paymentMethod = overrides?.paymentMethod ?? client.paymentMethod;
  if (!cfdiUse || !paymentMethod) {
    throw new Error("Define el uso de CFDI y el método de pago antes de emitir (heredan del cliente si están capturados).");
  }
  return { cfdiUse, paymentMethod };
}

export async function issueDocument(actor: Actor, documentId: string, overrides?: DocumentFiscalOverrides) {
  const document = await prisma.billingDocument.findFirst({
    where: { id: documentId, companyId: actor.activeCompanyId },
    include: { client: true, receivable: true },
  });
  if (!document || document.status !== "SOLICITADA") throw new Error("Ese documento no está pendiente de emisión.");
  if (document.receivable) throw new Error("Ese documento ya generó una cuenta por cobrar.");
  const client = document.kind === INTERCOMPANY_KIND
    ? await ensureIntercompanyClientFiscal(document.clientId)
    : document.client;
  const fiscal = document.kind === "REMISION" ? null : fiscalForDocument(client, overrides);
  const issuedAt = new Date();
  const dueAt = addDays(issuedAt, document.creditDays);
  await prisma.billingDocument.update({
    where: { id: document.id },
    data: {
      status: "EMITIDA",
      fiscalStatus: document.kind === "REMISION" ? "NO_APLICA" : "PENDIENTE",
      fiscalError: null,
      issuedAt,
      dueAt,
      issuedByUserId: actor.userId,
      cfdiUseSnapshot: fiscal?.cfdiUse ?? null,
      paymentMethodSnapshot: fiscal?.paymentMethod ?? null,
      version: { increment: 1 },
    },
  });
  if (document.kind !== "REMISION") await stampBillingDocument(document.id);
  if (document.kind !== "REMISION" && document.total > 0) {
    await prisma.receivable.create({
      data: {
        companyId: document.companyId,
        documentId: document.id,
        clientId: document.clientId,
        sellerUserId: document.client.ownerUserId,
        amount: document.total,
        balance: document.total,
        dueAt,
        status: "ABIERTA",
      },
    });
  }
  if (document.kind === "FACTURA_INTERCOMPANIA") {
    const systron = await prisma.company.findUnique({ where: { code: "SYSTRON" } });
    const supplier = await prisma.supplier.findUnique({ where: { id: INTERCOMPANY_SUPPLIER_ID } });
    if (!systron || !supplier) throw new Error("Falta el proveedor fijo Servomotores en SYSTRON.");
    await prisma.payable.create({
      data: {
        companyId: systron.id,
        supplierId: supplier.id,
        documentId: document.id,
        equipmentId: document.equipmentId,
        amount: document.total,
        balance: document.total,
        dueAt,
        status: "ABIERTA",
      },
    });
  }
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: document.id,
    action: "EMISION",
    summary: document.kind === "REMISION"
      ? `${document.folio} generada. Habilita la salida física cuando corresponda.`
      : `${document.folio} emitida. La cuenta por cobrar quedó abierta. El timbrado sigue pendiente.`,
    authorUserId: actor.userId,
  });
}

export async function retryFiscal(actor: Actor, documentId: string, overrides?: DocumentFiscalOverrides) {
  const document = await prisma.billingDocument.findFirst({
    where: { id: documentId, companyId: actor.activeCompanyId },
    include: { client: true },
  });
  if (!document || document.fiscalStatus === "TIMBRADA" || document.fiscalStatus === "NO_APLICA") throw new Error("Ese documento no tiene un timbrado por reintentar.");
  if (document.kind !== "REMISION") {
    const fiscal = fiscalForDocument(document.client, {
      cfdiUse: overrides?.cfdiUse ?? document.cfdiUseSnapshot,
      paymentMethod: overrides?.paymentMethod ?? document.paymentMethodSnapshot,
    });
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: { cfdiUseSnapshot: fiscal.cfdiUse, paymentMethodSnapshot: fiscal.paymentMethod, fiscalError: null },
    });
  }
  await stampBillingDocument(document.id);
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: document.id,
    action: "REINTENTO",
    summary: `Reintento fiscal de ${document.folio}. Sigue siendo el mismo documento.`,
    authorUserId: actor.userId,
  });
}

export async function issueFreeInvoice(
  actor: Actor,
  input: { clientId: string; concept: string; amount: number; creditDays: number | null },
) {
  const client = await prisma.client.findFirst({ where: { id: input.clientId, companyId: actor.activeCompanyId, active: true, isSystem: false } });
  if (!client) throw new Error("Selecciona un cliente activo de esta empresa.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El importe no es válido.");
  const total = roundMoney(input.amount);
  const subtotal = roundMoney(total / 1.16);
  const iva = roundMoney(total - subtotal);
  const folio = await allocateFolio(actor.activeCompanyId, "FAC");
  const issuedAt = new Date();
  const creditDays = input.creditDays ?? client.creditDays ?? 0;
  const dueAt = addDays(issuedAt, creditDays);
  const document = await prisma.billingDocument.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      kind: "FACTURA_LIBRE",
      status: "EMITIDA",
      clientId: client.id,
      concept: input.concept,
      subtotal,
      iva,
      total,
      creditDays,
      rfcSnapshot: client.rfc,
      issuedAt,
      dueAt,
      fiscalStatus: "PENDIENTE",
      fiscalError: null,
      issuedByUserId: actor.userId,
      lines: { create: [{ concept: input.concept, quantity: 1, unitPrice: subtotal, amount: subtotal }] },
    },
  });
  await prisma.receivable.create({
    data: {
      companyId: actor.activeCompanyId,
      documentId: document.id,
      clientId: client.id,
      sellerUserId: client.ownerUserId,
      amount: total,
      balance: total,
      dueAt,
      status: "ABIERTA",
    },
  });
  await stampBillingDocument(document.id);
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: document.id,
    action: "EMISION",
    summary: `${folio} es factura libre. No creó equipo, diagnóstico ni venta.`,
    authorUserId: actor.userId,
  });
  return document;
}

function isPrismaUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function intercompanyKeyForQuote(quote: { id: string; technicalCaseId: string | null }) {
  if (!quote.technicalCaseId) return `quote:${quote.id}`;
  const row = await prisma.technicalCase.findUnique({
    where: { id: quote.technicalCaseId },
    select: { attentionId: true },
  });
  return row?.attentionId ?? `quote:${quote.id}`;
}

async function findIntercompanyInvoice(baseQuoteId: string, key: string) {
  const attentionId = key.startsWith("quote:") ? null : key;
  const caseIds = attentionId
    ? (await prisma.technicalCase.findMany({ where: { attentionId }, select: { id: true } })).map((row) => row.id)
    : [];
  return prisma.billingDocument.findFirst({
    where: {
      kind: INTERCOMPANY_KIND,
      status: { not: "CANCELADA" },
      OR: [
        { intercompanyKey: key },
        { quoteId: baseQuoteId },
        ...(caseIds.length > 0 ? [{ technicalCaseId: { in: caseIds } }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Siguiente FAC de la empresa que no esté ocupado por otro documento (ciclo SRV u otro consecutivo). */
async function allocateUniqueFacFolio(companyId: string) {
  for (let attempt = 0; attempt < 25; attempt++) {
    const folio = await allocateFolio(companyId, "FAC");
    const taken = await prisma.billingDocument.findUnique({
      where: { companyId_folio: { companyId, folio } },
    });
    if (!taken) return folio;
  }
  throw new Error("No hay un folio FAC libre en Servomotores.");
}

async function ensureIntercompanyClientFiscal(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Falta el cliente fijo SYSTRON en Servomotores.");
  if (client.cfdiUse && client.paymentMethod) return client;
  return prisma.client.update({
    where: { id: client.id },
    data: {
      cfdiUse: client.cfdiUse || MIN_INTERCOMPANY_CFDI_USE,
      paymentMethod: client.paymentMethod || MIN_INTERCOMPANY_PAYMENT_METHOD,
    },
  });
}

async function intercompanyParties(clientId: string) {
  const client = await ensureIntercompanyClientFiscal(clientId);
  const fiscal = fiscalForDocument(client);
  const systron = await prisma.company.findUnique({ where: { code: "SYSTRON" } });
  const supplier = await prisma.supplier.findUnique({ where: { id: INTERCOMPANY_SUPPLIER_ID } });
  if (!systron || !supplier || supplier.companyId !== systron.id) {
    throw new Error("Falta el proveedor fijo Servomotores en SYSTRON.");
  }
  return { client, fiscal, systron, supplier };
}

function intercompanyLines(lines: Array<{ concept: string; quantity: number; unitPrice: number | null }>) {
  return lines.map((line) => ({
    concept: line.concept,
    quantity: line.quantity,
    unitPrice: line.unitPrice ?? 0,
    amount: roundMoney(line.quantity * (line.unitPrice ?? 0)),
  }));
}

/** Emite una solicitud intercompañía ya creada: CxC en Servomotores y CxP en Systron. Idempotente. */
async function issueIntercompanyBalances(actor: Actor, documentId: string) {
  const before = await prisma.billingDocument.findUnique({
    where: { id: documentId },
    include: { receivable: true, payable: true },
  });
  if (!before) throw new Error("No se encontró la factura a SYSTRON.");
  if (before.status === "EMITIDA" && before.receivable && before.payable) return before;
  const parties = await intercompanyParties(before.clientId);
  const issuedAt = before.issuedAt ?? new Date();
  const dueAt = before.dueAt ?? addDays(issuedAt, before.creditDays);
  const key = before.intercompanyKey ?? await intercompanyKeyForQuote({
    id: before.quoteId ?? before.id,
    technicalCaseId: before.technicalCaseId,
  });
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.billingDocument.findUnique({
        where: { id: documentId },
        include: { receivable: true, payable: true },
      });
      if (!current) return;
      if (current.status !== "EMITIDA") {
        await tx.billingDocument.update({
          where: { id: current.id },
          data: {
            status: "EMITIDA",
            fiscalStatus: "PENDIENTE",
            fiscalError: null,
            issuedAt,
            dueAt,
            issuedByUserId: actor.userId,
            cfdiUseSnapshot: parties.fiscal.cfdiUse,
            paymentMethodSnapshot: parties.fiscal.paymentMethod,
            intercompanyKey: current.intercompanyKey ?? key,
            version: { increment: 1 },
          },
        });
      }
      if (!current.receivable && current.total > 0) {
        await tx.receivable.create({
          data: {
            companyId: current.companyId,
            documentId: current.id,
            clientId: current.clientId,
            sellerUserId: parties.client.ownerUserId,
            amount: current.total,
            balance: current.total,
            dueAt,
            status: "ABIERTA",
          },
        });
      }
      if (!current.payable) {
        await tx.payable.create({
          data: {
            companyId: parties.systron.id,
            supplierId: parties.supplier.id,
            documentId: current.id,
            equipmentId: current.equipmentId,
            amount: current.total,
            balance: current.total,
            dueAt,
            status: "ABIERTA",
          },
        });
      }
    });
  } catch (error) {
    if (!isPrismaUnique(error)) throw error;
    const raced = await prisma.billingDocument.findUnique({
      where: { id: documentId },
      include: { receivable: true, payable: true },
    });
    if (raced?.status === "EMITIDA" && raced.receivable && raced.payable) return raced;
    throw error;
  }
  await stampBillingDocument(documentId);
  await recordHistory({
    companyId: before.companyId,
    entityType: "DOCUMENTO",
    entityId: before.id,
    action: "EMISION",
    summary: `${before.folio} emitida a SYSTRON al solicitar la factura del cliente final. Quedaron la cuenta por cobrar y la cuenta por pagar.`,
    authorUserId: actor.userId,
  });
  return prisma.billingDocument.findUnique({ where: { id: documentId } });
}

/**
 * Al solicitar la factura del cliente final, Servomotores emite la suya a SYSTRON.
 * Una por atención. La segunda llamada devuelve la misma y no duplica CxC ni CxP.
 */
async function issueServomotoresInvoiceForEndClientRequest(actor: Actor, baseQuoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: baseQuoteId },
    include: { lines: true, client: true, company: true },
  });
  if (!quote || quote.company.code !== "SERVOMOTORES" || !quote.client.isSystem) return;
  const key = await intercompanyKeyForQuote(quote);
  const existing = await findIntercompanyInvoice(quote.id, key);
  if (existing) {
    await issueIntercompanyBalances(actor, existing.id);
    return;
  }
  const totals = quoteTotals(quote.lines, quote.discountPct);
  if (!totals || totals.total <= 0) throw new Error("La cotización base no tiene importe.");
  const parties = await intercompanyParties(quote.clientId);
  const concept = quote.lines.map((line) => line.concept).join("; ") || quote.folio;
  const creditDays = quote.creditDays ?? parties.client.creditDays ?? 0;
  const lineData = intercompanyLines(quote.lines);

  for (let attempt = 0; attempt < 8; attempt++) {
    const raced = await findIntercompanyInvoice(quote.id, key);
    if (raced) {
      await issueIntercompanyBalances(actor, raced.id);
      return;
    }
    const folio = await allocateUniqueFacFolio(quote.companyId);
    const issuedAt = new Date();
    const dueAt = addDays(issuedAt, creditDays);
    try {
      const created = await prisma.$transaction(async (tx) => {
        const again = await tx.billingDocument.findFirst({
          where: {
            kind: INTERCOMPANY_KIND,
            status: { not: "CANCELADA" },
            OR: [{ intercompanyKey: key }, { quoteId: quote.id }],
          },
        });
        if (again) return null;
        return tx.billingDocument.create({
          data: {
            folio,
            companyId: quote.companyId,
            kind: INTERCOMPANY_KIND,
            status: "EMITIDA",
            clientId: quote.clientId,
            quoteId: quote.id,
            technicalCaseId: quote.technicalCaseId,
            equipmentId: quote.equipmentId,
            intercompanyKey: key,
            concept,
            subtotal: totals.subtotal,
            iva: totals.iva,
            total: totals.total,
            creditDays,
            rfcSnapshot: parties.client.rfc,
            cfdiUseSnapshot: parties.fiscal.cfdiUse,
            paymentMethodSnapshot: parties.fiscal.paymentMethod,
            issuedAt,
            dueAt,
            fiscalStatus: "PENDIENTE",
            requestedByUserId: actor.userId,
            issuedByUserId: actor.userId,
            lines: { create: lineData },
            receivable: {
              create: {
                companyId: quote.companyId,
                clientId: quote.clientId,
                sellerUserId: parties.client.ownerUserId,
                amount: totals.total,
                balance: totals.total,
                dueAt,
                status: "ABIERTA",
              },
            },
            payable: {
              create: {
                companyId: parties.systron.id,
                supplierId: parties.supplier.id,
                equipmentId: quote.equipmentId,
                amount: totals.total,
                balance: totals.total,
                dueAt,
                status: "ABIERTA",
              },
            },
          },
        });
      });
      if (!created) {
        const winner = await findIntercompanyInvoice(quote.id, key);
        if (!winner) continue;
        await issueIntercompanyBalances(actor, winner.id);
        return;
      }
      await stampBillingDocument(created.id);
      await recordHistory({
        companyId: quote.companyId,
        entityType: "DOCUMENTO",
        entityId: created.id,
        action: "EMISION",
        summary: `${created.folio} emitida a SYSTRON al solicitar la factura del cliente final. Quedaron la cuenta por cobrar y la cuenta por pagar.`,
        authorUserId: actor.userId,
      });
      return;
    } catch (error) {
      if (!isPrismaUnique(error)) throw error;
      const winner = await findIntercompanyInvoice(quote.id, key);
      if (winner) {
        await issueIntercompanyBalances(actor, winner.id);
        return;
      }
    }
  }
  throw new Error("No se pudo emitir la factura de Servomotores a SYSTRON.");
}

export async function requestIntercompany(actor: Actor, quoteId: string) {
  if (actor.activeCompanyCode !== "SERVOMOTORES") throw new Error("La factura a SYSTRON se solicita en Servomotores.");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId, status: "AUTORIZADA" },
    include: { lines: true, client: true },
  });
  if (!quote || !quote.client.isSystem) throw new Error("La base autorizada de Servomotores a SYSTRON es la que se factura.");
  const key = await intercompanyKeyForQuote(quote);
  const existing = await findIntercompanyInvoice(quote.id, key);
  if (existing) return existing;
  const totals = quoteTotals(quote.lines, quote.discountPct);
  if (!totals || totals.total <= 0) throw new Error("La cotización base no tiene importe.");
  await ensureIntercompanyClientFiscal(quote.clientId);
  const concept = quote.lines.map((line) => line.concept).join("; ") || quote.folio;
  const lineData = intercompanyLines(quote.lines);
  for (let attempt = 0; attempt < 8; attempt++) {
    const folio = await allocateUniqueFacFolio(actor.activeCompanyId);
    try {
      const document = await prisma.billingDocument.create({
        data: {
          folio,
          companyId: actor.activeCompanyId,
          kind: INTERCOMPANY_KIND,
          status: "SOLICITADA",
          clientId: quote.clientId,
          quoteId: quote.id,
          technicalCaseId: quote.technicalCaseId,
          equipmentId: quote.equipmentId,
          intercompanyKey: key,
          concept,
          subtotal: totals.subtotal,
          iva: totals.iva,
          total: totals.total,
          creditDays: quote.creditDays ?? quote.client.creditDays ?? 0,
          rfcSnapshot: quote.client.rfc,
          fiscalStatus: "PENDIENTE",
          requestedByUserId: actor.userId,
          lines: { create: lineData },
        },
      });
      await recordHistory({
        companyId: actor.activeCompanyId,
        entityType: "DOCUMENTO",
        entityId: document.id,
        action: "SOLICITUD",
        summary: `${folio} solicita la factura de Servomotores a SYSTRON. No depende del cierre técnico ni de la factura al cliente final.`,
        authorUserId: actor.userId,
      });
      return document;
    } catch (error) {
      if (!isPrismaUnique(error)) throw error;
      const winner = await findIntercompanyInvoice(quote.id, key);
      if (winner) return winner;
    }
  }
  throw new Error("No se pudo solicitar la factura a SYSTRON.");
}

export async function registerClientPayment(
  actor: Actor,
  input: { clientId: string; receivableId: string; amount: number; method: "EFECTIVO" | "TRANSFERENCIA"; receipt: string; destination: string },
) {
  if (!input.receipt.trim()) throw new Error("El pago exige comprobante.");
  if (!input.destination.trim()) throw new Error("Indica el destino del pago.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El importe no es válido.");
  const receivable = await prisma.receivable.findFirst({
    where: { id: input.receivableId, companyId: actor.activeCompanyId, clientId: input.clientId },
    include: { document: true, client: true },
  });
  if (!receivable || receivable.balance <= 0) throw new Error("Esa cuenta no tiene saldo en esta empresa.");
  if (input.amount > receivable.balance) throw new Error("El pago no puede exceder el saldo.");
  const invoice = receivable.document.kind !== "REMISION";
  if (input.method === "EFECTIVO" && invoice && !cashAllowedOnInvoice(input.amount, receivable.client.requiresInvoice)) {
    throw new Error("Una factura de $2,000 o más no acepta efectivo.");
  }
  const immediate = actor.role === "COORDINACION_ADMINISTRACION" || actor.role === "CEO" || actor.role === "ADMINISTRADOR";
  const folio = await allocateFolio(actor.activeCompanyId, "PAG");
  const payment = await prisma.payment.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      clientId: input.clientId,
      amount: roundMoney(input.amount),
      method: input.method,
      receipt: input.receipt.trim(),
      destination: input.destination.trim(),
      status: immediate ? "VALIDADO" : "PENDIENTE",
      kind: "CLIENTE",
      authorUserId: actor.userId,
      applications: { create: [{ receivableId: receivable.id, amount: roundMoney(input.amount), confirmedAt: immediate ? new Date() : null }] },
    },
  });
  if (immediate) {
    await applyReceivable(receivable.id, roundMoney(input.amount));
    await recordCompanyCash(actor.activeCompanyId, "INGRESO", roundMoney(input.amount), input.method, folio, payment.id);
  }
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "PAGO",
    entityId: payment.id,
    action: immediate ? "VALIDACION" : "ALTA",
    summary: immediate
      ? `${folio} quedó validado y redujo el saldo.`
      : `${folio} quedó pendiente de validación. Todavía no reduce el saldo.`,
    authorUserId: actor.userId,
  });
  return payment;
}

async function applyReceivable(receivableId: string, amount: number) {
  const row = await prisma.receivable.findUnique({ where: { id: receivableId } });
  if (!row) return;
  const balance = roundMoney(row.balance - amount);
  await prisma.receivable.update({
    where: { id: row.id },
    data: { balance, status: balanceStatus(balance, row.amount) },
  });
}

export async function validatePayment(actor: Actor, paymentId: string) {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, companyId: actor.activeCompanyId, status: "PENDIENTE", kind: "CLIENTE" },
    include: { applications: true },
  });
  if (!payment) throw new Error("Ese pago no está pendiente en esta empresa.");
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "VALIDADO" } });
  await recordCompanyCash(payment.companyId, "INGRESO", payment.amount, payment.method, payment.folio, payment.id);
  for (const application of payment.applications) {
    if (application.receivableId) await applyReceivable(application.receivableId, application.amount);
    await prisma.paymentApplication.update({ where: { id: application.id }, data: { confirmedAt: new Date() } });
  }
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "PAGO",
    entityId: payment.id,
    action: "VALIDACION",
    summary: `${payment.folio} validado. El saldo de la cuenta por cobrar bajó.`,
    authorUserId: actor.userId,
  });
}

export async function registerIntercompanyPayment(
  actor: Actor,
  input: { payableId: string; amount: number; receipt: string; destination: string },
) {
  if (actor.activeCompanyCode !== "SYSTRON") throw new Error("El pago a Servomotores sale de SYSTRON.");
  if (!input.receipt.trim() || !input.destination.trim()) throw new Error("El pago exige comprobante y cuenta de origen.");
  const payable = await prisma.payable.findFirst({ where: { id: input.payableId, companyId: actor.activeCompanyId } });
  if (!payable || payable.balance <= 0) throw new Error("Esa cuenta por pagar no tiene saldo.");
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > payable.balance) throw new Error("El importe no cubre un pago parcial válido.");
  const folio = await allocateFolio(actor.activeCompanyId, "PAG");
  const payment = await prisma.payment.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      amount: roundMoney(input.amount),
      method: "TRANSFERENCIA",
      receipt: input.receipt.trim(),
      destination: input.destination.trim(),
      status: "PENDIENTE",
      kind: "INTERCOMPANIA",
      authorUserId: actor.userId,
      applications: { create: [{ payableId: payable.id, amount: roundMoney(input.amount) }] },
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "PAGO",
    entityId: payment.id,
    action: "ALTA",
    summary: `${folio} salió de SYSTRON hacia Servomotores. Falta confirmar la recepción.`,
    authorUserId: actor.userId,
  });
  return payment;
}

export async function confirmIntercompanyPayment(actor: Actor, paymentId: string) {
  if (actor.activeCompanyCode !== "SERVOMOTORES") throw new Error("Servomotores confirma que el pago entró a su cuenta.");
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, kind: "INTERCOMPANIA", status: "PENDIENTE" },
    include: { applications: { include: { payable: { include: { document: { include: { receivable: true } } } } } } },
  });
  if (!payment) throw new Error("Ese pago intercompañía no está pendiente.");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDIENTE" }, data: { status: "VALIDADO" } });
    if (updated.count === 0) throw new ConcurrencyError();
    for (const application of payment.applications) {
      if (!application.payable) continue;
      const balance = roundMoney(application.payable.balance - application.amount);
      await tx.payable.update({
        where: { id: application.payable.id },
        data: { balance, status: balanceStatus(balance, application.payable.amount) },
      });
      const receivable = application.payable.document?.receivable;
      if (receivable) {
        const next = roundMoney(receivable.balance - application.amount);
        await tx.receivable.update({
          where: { id: receivable.id },
          data: { balance: next, status: balanceStatus(next, receivable.amount) },
        });
      }
      await tx.paymentApplication.update({ where: { id: application.id }, data: { confirmedAt: new Date() } });
    }
  });
  await recordCompanyCash(payment.companyId, "EGRESO", payment.amount, payment.method, payment.folio, payment.id);
  const servomotores = await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } });
  if (servomotores) await recordCompanyCash(servomotores.id, "INGRESO", payment.amount, payment.method, payment.folio, `${payment.id}-sm`);
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "PAGO",
    entityId: payment.id,
    action: "VALIDACION",
    summary: `${payment.folio} entró a Servomotores. Bajó la cuenta por cobrar y la cuenta por pagar.`,
    authorUserId: actor.userId,
  });
}

export async function addCollectionNote(actor: Actor, receivableId: string, note: string, followUpAt: Date | null) {
  const row = await prisma.receivable.findFirst({ where: { id: receivableId, companyId: actor.activeCompanyId } });
  if (!row) throw new Error("Esa cuenta no es de esta empresa.");
  if (actor.role === "VENTAS" && row.sellerUserId !== actor.userId) throw new Error(SALES_NOT_ASSIGNED_MESSAGE);
  await prisma.collectionNote.create({
    data: { receivableId: row.id, note, followUpAt, authorUserId: actor.userId },
  });
}
