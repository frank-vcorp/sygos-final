import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { allocateFolio, serviceFolioForAttention } from "./folios";
import { recordCompanyCash } from "./purchases";
import {
  cancelBillingDocumentInFacturapi,
  isBillingDocumentEligibleForRep,
  isValidSatCancelMotive,
  stampBillingDocument,
  stampPaymentComplement,
  triggerRepAfterPaymentValidation,
} from "./facturapi";
import { inSandbox } from "./db";
import {
  parseCompanyFiscalConfig,
  resolveSatDefaultsForDocument,
  syncIntercompanyPartiesFromCompany,
} from "./fiscal-config";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { linesForTotal, quoteTotals, roundMoney } from "./money";
import type { Role } from "./roles";
import { SALES_NOT_ASSIGNED_MESSAGE } from "./sales-assignment";
import { assertClientFiscalReadyForInvoice } from "./client-fiscal";
import {
  assertBillingDocumentSatKeysForFiscal,
  billingLineSatKeysEditable,
  parseSatProductKey,
  parseSatUnitKey,
  resolveSatUnitName,
} from "./billing-line-sat";
import { resolvePaymentFormForDocument } from "./sat-payment-method";

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
    where: { quoteId, kind: { not: "NOTA_CREDITO" }, status: { in: ["SOLICITADA", "EMITIDA", "ERROR_FISCAL"] } },
  });
  return roundMoney(rows.reduce((sum, row) => sum + row.total, 0));
}

async function invoicedTotalForFieldService(fieldServiceCaseId: string) {
  const rows = await prisma.billingDocument.findMany({
    where: { fieldServiceCaseId, kind: { not: "NOTA_CREDITO" }, status: { in: ["SOLICITADA", "EMITIDA", "ERROR_FISCAL"] } },
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

export function buildQuoteBillingLines(input: {
  lines: Array<{ id?: string; concept: string; quantity: number; unitPrice: number | null }>;
  discountPct: number;
  targetSubtotal: number;
  satDefaults: { productKey: string; unitKey: string; unitName: string; taxability: string };
  lineMode: "LINE_BY_LINE" | "CONSOLIDATED";
  isPartial: boolean;
  consolidatedConcept: string;
}) {
  if (input.isPartial || input.lineMode === "CONSOLIDATED" || input.lines.length === 0) {
    return [
      {
        concept: input.consolidatedConcept,
        quantity: 1,
        unitPrice: input.targetSubtotal,
        discountAmount: 0,
        amount: input.targetSubtotal,
        taxIncluded: false,
        satProductKey: null as string | null,
        satUnitKey: null as string | null,
        satUnitName: null as string | null,
        taxability: input.satDefaults.taxability,
        quoteLineId: null as string | null,
      },
    ];
  }

  const built = input.lines.map((line) => {
    const unitPrice = roundMoney(line.unitPrice ?? 0);
    const gross = roundMoney(line.quantity * unitPrice);
    const discountAmount = input.discountPct > 0 ? roundMoney(gross * (input.discountPct / 100)) : 0;
    const amount = roundMoney(gross - discountAmount);
    return {
      concept: line.concept,
      quantity: line.quantity,
      unitPrice,
      discountAmount,
      amount,
      taxIncluded: false,
      satProductKey: null as string | null,
      satUnitKey: null as string | null,
      satUnitName: null as string | null,
      taxability: input.satDefaults.taxability,
      quoteLineId: line.id ?? null,
    };
  });

  const sumNet = roundMoney(built.reduce((sum, row) => sum + row.amount, 0));
  const drift = roundMoney(input.targetSubtotal - sumNet);
  if (drift !== 0 && built.length > 0) {
    const last = built[built.length - 1]!;
    last.discountAmount = roundMoney(Math.max(0, last.discountAmount - drift));
    last.amount = roundMoney(last.amount + drift);
  }
  return built;
}

async function safeStampBillingDocument(documentId: string) {
  try {
    await stampBillingDocument(documentId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al timbrar en Facturapi.";
    await prisma.billingDocument
      .update({
        where: { id: documentId },
        data: { fiscalStatus: "ERROR", fiscalError: `${message} El reintento usa este mismo documento.` },
      })
      .catch(() => undefined);
  }
}

export async function requestFromQuote(actor: Actor, quoteId: string, kind: "FACTURA" | "REMISION", amount: number | null) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId },
    include: { lines: true, client: true, fieldServiceCase: true, company: true, equipment: { select: { kind: true } } },
  });
  if (!quote || quote.status !== "AUTORIZADA") throw new Error("Solo se solicita documento de una cotización autorizada.");
  if (quote.quoteType === "CAMPO") {
    if (!quote.fieldServiceCase) throw new Error("La cotización de campo aún no tiene un SCA; autoriza y confirma el caso en servicio de campo.");
    return requestFromFieldServiceCase(actor, quote.fieldServiceCase.id, kind, amount);
  }
  if (actor.role === "VENTAS" && quote.sellerUserId !== actor.userId) throw new Error(SALES_NOT_ASSIGNED_MESSAGE);
  if (kind === "FACTURA") {
    assertClientFiscalReadyForInvoice(quote.client);
  }
  if (quote.technicalCaseId && kind === "FACTURA") {
    const linkedCase = await prisma.technicalCase.findUnique({
      where: { id: quote.technicalCaseId },
      select: { attentionId: true },
    });
    if (!linkedCase) throw new Error("No se encontró la operación ligada a la cotización.");
    await assertAtMostOneServiceInvoice(linkedCase.attentionId, kind);
  }
  const chosenLines = linesForTotal(quote.lines, quote.quoteType, quote.status);
  const totals = quoteTotals(chosenLines, quote.discountPct);
  if (!totals) throw new Error("La cotización no tiene importe.");
  const used = await invoicedTotal(quote.id);
  const remaining = roundMoney(totals.total - used);
  if (remaining <= 0 && kind === "FACTURA") throw new Error("Esa operación ya no tiene saldo por facturar.");
  const total = roundMoney(amount ?? remaining);
  if (kind === "FACTURA" && (total <= 0 || total > remaining)) throw new Error("El importe no puede exceder el saldo permitido.");
  if (kind === "FACTURA" && quote.linkedQuoteId && !quote.client.isSystem) {
    await issueServomotoresInvoiceForEndClientRequest(actor, quote.linkedQuoteId);
  }
  const ratio = totals.total === 0 ? 0 : total / totals.total;
  const subtotal = roundMoney(totals.base * ratio);
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
  const concept = chosenLines.map((line) => line.concept).join("; ") || quote.folio;
  const fiscalConfig = parseCompanyFiscalConfig(quote.company);
  const satDefaults = resolveSatDefaultsForDocument(fiscalConfig, {
    companyCode: quote.company.code,
    documentKind: kind,
    quoteType: quote.quoteType,
    equipmentKind: quote.equipment?.kind ?? null,
  });
  const isPartial = total < totals.total && totals.total > 0;
  const billingLines = buildQuoteBillingLines({
    lines: chosenLines,
    discountPct: quote.discountPct,
    targetSubtotal: subtotal,
    satDefaults,
    lineMode: fiscalConfig.fiscalLineMode,
    isPartial,
    consolidatedConcept: concept,
  });
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
        lines: { create: billingLines },
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
    include: { client: true, company: true, quote: { include: { lines: true } } },
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
  const total = roundMoney(amount ?? remaining);
  if (kind === "FACTURA" && (total <= 0 || total > remaining)) throw new Error("El importe no puede exceder el saldo permitido.");
  const subtotal = roundMoney(total / 1.16);
  const iva = roundMoney(total - subtotal);
  const folio = await allocateFolio(actor.activeCompanyId, kind === "REMISION" ? "REM" : "FAC");
  const concept = `${row.concept} · ${row.folio}${row.description.trim() ? `: ${row.description.trim()}` : ""}`;
  const fiscalConfig = parseCompanyFiscalConfig(row.company);
  const satDefaults = resolveSatDefaultsForDocument(fiscalConfig, {
    companyCode: row.company.code,
    documentKind: kind,
    quoteType: "CAMPO",
    hasFieldServiceCase: true,
  });
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
      lines: {
        create: [
          {
            concept,
            quantity: 1,
            unitPrice: subtotal,
            discountAmount: 0,
            amount: subtotal,
            taxIncluded: false,
            satProductKey: null,
            satUnitKey: null,
            satUnitName: null,
            taxability: satDefaults.taxability,
          },
        ],
      },
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
      serviceCompany: true,
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
  const fiscalConfig = parseCompanyFiscalConfig(row.serviceCompany);
  const satDefaults = resolveSatDefaultsForDocument(fiscalConfig, {
    companyCode: row.serviceCompany.code,
    documentKind: kind,
    quoteType: "DIAGNOSTICO",
    equipmentKind: row.equipment.kind,
  });
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
      lines: {
        create: [
          {
            concept,
            quantity: 1,
            unitPrice: subtotal,
            discountAmount: 0,
            amount: subtotal,
            taxIncluded: false,
            satProductKey: null,
            satUnitKey: null,
            satUnitName: null,
            taxability: satDefaults.taxability,
          },
        ],
      },
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

export type DocumentFiscalOverrides = {
  cfdiUse: string | null;
  paymentMethod: string | null;
  paymentForm?: string | null;
};

function fiscalForDocument(
  client: { cfdiUse: string | null; paymentMethod: string | null },
  overrides?: DocumentFiscalOverrides,
): { cfdiUse: string; paymentMethod: string; paymentForm: string } {
  const cfdiUse = overrides?.cfdiUse ?? client.cfdiUse;
  const paymentMethod = overrides?.paymentMethod ?? client.paymentMethod;
  if (!cfdiUse || !paymentMethod) {
    throw new Error("Define el uso de CFDI y el método de pago antes de emitir (heredan del cliente si están capturados).");
  }
  const paymentForm = resolvePaymentFormForDocument(paymentMethod, overrides?.paymentForm);
  return { cfdiUse, paymentMethod, paymentForm };
}

export async function issueDocument(actor: Actor, documentId: string, overrides?: DocumentFiscalOverrides) {
  const document = await prisma.billingDocument.findFirst({
    where: { id: documentId, companyId: actor.activeCompanyId },
    include: { client: true, receivable: true, lines: true },
  });
  if (!document || document.status !== "SOLICITADA") throw new Error("Ese documento no está pendiente de emisión.");
  if (document.receivable) throw new Error("Ese documento ya generó una cuenta por cobrar.");
  assertBillingDocumentSatKeysForFiscal(document);
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
      rfcSnapshot: client.rfc ?? document.rfcSnapshot,
      cfdiUseSnapshot: fiscal?.cfdiUse ?? null,
      paymentMethodSnapshot: fiscal?.paymentMethod ?? null,
      paymentFormSnapshot: fiscal?.paymentForm ?? null,
      version: { increment: 1 },
    },
  });
  if (document.kind !== "REMISION") await safeStampBillingDocument(document.id);
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
  const latest = await prisma.billingDocument.findUnique({ where: { id: document.id }, select: { fiscalStatus: true } });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: document.id,
    action: "EMISION",
    summary: document.kind === "REMISION"
      ? `${document.folio} generada. Habilita la salida física cuando corresponda.`
      : latest?.fiscalStatus === "TIMBRADA"
        ? `${document.folio} emitida y timbrada. La cuenta por cobrar quedó abierta.`
        : `${document.folio} emitida. La cuenta por cobrar quedó abierta (estado fiscal: ${latest?.fiscalStatus ?? "PENDIENTE"}).`,
    authorUserId: actor.userId,
  });
}

export async function retryFiscal(actor: Actor, documentId: string, overrides?: DocumentFiscalOverrides) {
  const document = await prisma.billingDocument.findFirst({
    where: { id: documentId, companyId: actor.activeCompanyId },
    include: { client: true, lines: true },
  });
  if (
    !document
    || document.status === "CANCELADA"
    || document.fiscalStatus === "TIMBRADA"
    || document.fiscalStatus === "NO_APLICA"
    || document.fiscalStatus === "CANCELADA"
  ) {
    throw new Error("Ese documento no tiene un timbrado por reintentar.");
  }
  assertBillingDocumentSatKeysForFiscal(document);
  const client = document.kind === INTERCOMPANY_KIND
    ? await ensureIntercompanyClientFiscal(document.clientId)
    : document.client;
  if (document.kind !== "REMISION") {
    const fiscal = fiscalForDocument(client, {
      cfdiUse: overrides?.cfdiUse ?? document.cfdiUseSnapshot,
      paymentMethod: overrides?.paymentMethod ?? document.paymentMethodSnapshot,
      paymentForm: overrides?.paymentForm ?? document.paymentFormSnapshot,
    });
    await prisma.billingDocument.update({
      where: { id: document.id },
      data: {
        rfcSnapshot: client.rfc ?? document.rfcSnapshot,
        cfdiUseSnapshot: fiscal.cfdiUse,
        paymentMethodSnapshot: fiscal.paymentMethod,
        paymentFormSnapshot: fiscal.paymentForm,
        fiscalError: null,
      },
    });
  }
  await safeStampBillingDocument(document.id);
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
  input: {
    clientId: string;
    concept: string;
    amount: number;
    creditDays: number | null;
    cfdiUse?: string | null;
    paymentMethod?: string | null;
    paymentForm?: string | null;
  },
) {
  const client = await prisma.client.findFirst({ where: { id: input.clientId, companyId: actor.activeCompanyId, active: true, isSystem: false } });
  if (!client) throw new Error("Selecciona un cliente activo de esta empresa.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El importe no es válido.");
  const company = await prisma.company.findUnique({ where: { id: actor.activeCompanyId } });
  const fiscalConfig = parseCompanyFiscalConfig(company ?? { code: actor.activeCompanyCode });
  const satDefaults = resolveSatDefaultsForDocument(fiscalConfig, {
    companyCode: actor.activeCompanyCode,
    documentKind: "FACTURA_LIBRE",
  });
  const total = roundMoney(input.amount);
  const subtotal = roundMoney(total / 1.16);
  const iva = roundMoney(total - subtotal);
  const folio = await allocateFolio(actor.activeCompanyId, "FAC");
  const issuedAt = new Date();
  const creditDays = input.creditDays ?? client.creditDays ?? 0;
  const dueAt = addDays(issuedAt, creditDays);
  const cfdiUse = input.cfdiUse ?? client.cfdiUse;
  const paymentMethod = input.paymentMethod ?? client.paymentMethod;
  const paymentForm = paymentMethod ? resolvePaymentFormForDocument(paymentMethod, input.paymentForm) : null;

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
      cfdiUseSnapshot: cfdiUse,
      paymentMethodSnapshot: paymentMethod,
      paymentFormSnapshot: paymentForm,
      issuedAt,
      dueAt,
      fiscalStatus: "PENDIENTE",
      fiscalError: null,
      issuedByUserId: actor.userId,
      lines: {
        create: [
          {
            concept: input.concept,
            quantity: 1,
            unitPrice: subtotal,
            discountAmount: 0,
            amount: subtotal,
            taxIncluded: false,
            satProductKey: null,
            satUnitKey: null,
            satUnitName: null,
            taxability: satDefaults.taxability,
          },
        ],
      },
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
  await safeStampBillingDocument(document.id);
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
  const systron = await prisma.company.findUnique({ where: { code: "SYSTRON" } });
  if (systron) {
    await syncIntercompanyPartiesFromCompany(systron.id);
  }
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

function intercompanyLines(input: {
  company: { code?: string | null; fiscalLineMode?: string | null; fiscalConfigJson?: string | null };
  lines: Array<{ id?: string; concept: string; quantity: number; unitPrice: number | null }>;
  discountPct: number;
  targetSubtotal: number;
  consolidatedConcept: string;
}) {
  const config = parseCompanyFiscalConfig(input.company);
  const satDefaults = resolveSatDefaultsForDocument(config, {
    companyCode: "SERVOMOTORES",
    documentKind: INTERCOMPANY_KIND,
    equipmentKind: "MOT",
  });
  return buildQuoteBillingLines({
    lines: input.lines,
    discountPct: input.discountPct,
    targetSubtotal: input.targetSubtotal,
    satDefaults,
    lineMode: config.fiscalLineMode,
    isPartial: false,
    consolidatedConcept: input.consolidatedConcept,
  });
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
            rfcSnapshot: parties.client.rfc ?? current.rfcSnapshot,
            cfdiUseSnapshot: parties.fiscal.cfdiUse,
            paymentMethodSnapshot: parties.fiscal.paymentMethod,
            paymentFormSnapshot: parties.fiscal.paymentForm,
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
  await safeStampBillingDocument(documentId);
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
  const lineData = intercompanyLines({
    company: quote.company,
    lines: quote.lines,
    discountPct: quote.discountPct,
    targetSubtotal: totals.base,
    consolidatedConcept: concept,
  });

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
            subtotal: totals.base,
            iva: totals.iva,
            total: totals.total,
            creditDays,
            rfcSnapshot: parties.client.rfc,
            cfdiUseSnapshot: parties.fiscal.cfdiUse,
            paymentMethodSnapshot: parties.fiscal.paymentMethod,
            paymentFormSnapshot: parties.fiscal.paymentForm,
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
      await safeStampBillingDocument(created.id);
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
    include: { lines: true, client: true, company: true },
  });
  if (!quote || !quote.client.isSystem) throw new Error("La base autorizada de Servomotores a SYSTRON es la que se factura.");
  const key = await intercompanyKeyForQuote(quote);
  const existing = await findIntercompanyInvoice(quote.id, key);
  if (existing) return existing;
  const totals = quoteTotals(quote.lines, quote.discountPct);
  if (!totals || totals.total <= 0) throw new Error("La cotización base no tiene importe.");
  const syncedClient = await ensureIntercompanyClientFiscal(quote.clientId);
  const concept = quote.lines.map((line) => line.concept).join("; ") || quote.folio;
  const lineData = intercompanyLines({
    company: quote.company,
    lines: quote.lines,
    discountPct: quote.discountPct,
    targetSubtotal: totals.base,
    consolidatedConcept: concept,
  });
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
          subtotal: totals.base,
          iva: totals.iva,
          total: totals.total,
          creditDays: quote.creditDays ?? syncedClient.creditDays ?? 0,
          rfcSnapshot: syncedClient.rfc,
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
    await triggerRepAfterPaymentValidation(payment.id).catch(() => undefined);
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

/**
 * Un solo pago y un solo complemento (REP) que cubre varias facturas PPD del mismo cliente.
 * El saldo baja por el importe aplicado; el método PPD no las marca como pagadas.
 */
export async function registerMultiInvoicePaymentComplement(
  actor: Actor,
  input: {
    clientId: string;
    allocations: Array<{ documentId: string; amount: number }>;
    method: "EFECTIVO" | "TRANSFERENCIA";
    receipt: string;
    destination: string;
  },
  options?: { fetchFn?: typeof fetch },
) {
  if (!canIssueMultiInvoiceComplement(actor)) {
    throw new Error("Solo Coordinación, CEO o Administrador timbran un complemento de varias facturas.");
  }
  if (!input.receipt.trim()) throw new Error("El pago exige comprobante.");
  if (!input.destination.trim()) throw new Error("Indica el destino del pago.");
  if (input.allocations.length < 2) {
    throw new Error("Elige al menos dos facturas del mismo cliente.");
  }
  const seen = new Set<string>();
  for (const row of input.allocations) {
    if (seen.has(row.documentId)) throw new Error("No repitas la misma factura.");
    seen.add(row.documentId);
    if (!Number.isFinite(row.amount) || row.amount <= 0) throw new Error("Cada importe debe ser mayor a cero.");
  }

  const documents = await prisma.billingDocument.findMany({
    where: { id: { in: [...seen] }, companyId: actor.activeCompanyId, clientId: input.clientId },
    include: { receivable: true, client: true },
  });
  if (documents.length !== input.allocations.length) {
    throw new Error("Alguna factura no es de este cliente en esta empresa.");
  }
  const byId = new Map(documents.map((doc) => [doc.id, doc]));
  const client = documents[0]!.client;
  let total = 0;
  const applications: Array<{ receivableId: string; amount: number }> = [];
  for (const allocation of input.allocations) {
    const doc = byId.get(allocation.documentId);
    if (!doc) throw new Error("Alguna factura no es de este cliente en esta empresa.");
    if (doc.clientId !== input.clientId) throw new Error("Todas las facturas deben ser del mismo cliente.");
    if (!isBillingDocumentEligibleForRep(doc)) {
      throw new Error(`${doc.folio} no está timbrada en PPD. El complemento solo cubre esas facturas.`);
    }
    const balance = doc.receivable?.balance ?? 0;
    if (!doc.receivable || balance <= 0) throw new Error(`${doc.folio} no tiene saldo pendiente.`);
    const amount = roundMoney(allocation.amount);
    if (amount > balance) throw new Error(`El pago de ${doc.folio} no puede exceder el saldo.`);
    if (input.method === "EFECTIVO" && !cashAllowedOnInvoice(amount, client.requiresInvoice)) {
      throw new Error("Una factura de $2,000 o más no acepta efectivo.");
    }
    total = roundMoney(total + amount);
    applications.push({ receivableId: doc.receivable.id, amount });
  }

  const folio = await allocateFolio(actor.activeCompanyId, "PAG");
  const confirmedAt = new Date();
  const payment = await prisma.payment.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      clientId: input.clientId,
      amount: total,
      method: input.method,
      receipt: input.receipt.trim(),
      destination: input.destination.trim(),
      status: "VALIDADO",
      kind: "CLIENTE",
      authorUserId: actor.userId,
      applications: {
        create: applications.map((row) => ({ ...row, confirmedAt })),
      },
    },
  });
  for (const row of applications) {
    await applyReceivable(row.receivableId, row.amount);
  }
  await recordCompanyCash(actor.activeCompanyId, "INGRESO", total, input.method, folio, payment.id);
  const stamp = await stampPaymentComplement(payment.id, { isPaymentId: true, fetchFn: options?.fetchFn });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "PAGO",
    entityId: payment.id,
    action: "COMPLEMENTO_VARIAS",
    summary: `${folio} cubre ${applications.length} facturas del mismo cliente por ${total}.`,
    authorUserId: actor.userId,
  });
  return { payment, stamp };
}

function canIssueMultiInvoiceComplement(actor: Actor) {
  return actor.role === "ADMINISTRADOR" || actor.role === "CEO" || actor.role === "COORDINACION_ADMINISTRACION";
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
  await triggerRepAfterPaymentValidation(payment.id).catch(() => undefined);
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
  await triggerRepAfterPaymentValidation(payment.id).catch(() => undefined);
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

export async function requestDocumentCancellation(
  actor: Actor,
  documentId: string,
  input: { motive: string; substitutionDocId?: string | null },
) {
  if (!isValidSatCancelMotive(input.motive)) {
    throw new Error("El motivo SAT de cancelación debe ser 01, 02, 03 o 04.");
  }
  const doc = await prisma.billingDocument.findFirst({
    where: { id: documentId, companyId: actor.activeCompanyId },
    include: { client: true },
  });
  if (!doc) throw new Error("No se encontró el documento en esta empresa.");
  if (actor.role === "VENTAS") {
    if (doc.client.ownerUserId !== actor.userId) throw new Error(SALES_NOT_ASSIGNED_MESSAGE);
    throw new Error("Los vendedores no pueden solicitar cancelación fiscal.");
  }
  if (doc.status === "CANCELADA") throw new Error("Este documento ya está cancelado.");
  if (doc.cancellationStatus === "pending" || doc.cancellationStatus === "verifying") {
    throw new Error("Este documento ya tiene una cancelación en proceso ante el SAT.");
  }

  let substitutionDocId: string | null = null;
  if (input.motive === "01" || input.motive === "04") {
    const rawSub = input.substitutionDocId?.trim();
    if (!rawSub) {
      throw new Error(`El motivo ${input.motive} exige indicar la factura sustituta ya timbrada.`);
    }
    const subDoc = await prisma.billingDocument.findFirst({
      where: { id: rawSub, companyId: actor.activeCompanyId },
    });
    if (!subDoc || subDoc.id === doc.id || subDoc.status !== "EMITIDA") {
      throw new Error("La factura sustituta debe estar emitida en la misma empresa.");
    }
    const sandboxActive = await inSandbox();
    if (
      !sandboxActive
      && subDoc.fiscalStatus !== "TIMBRADA"
    ) {
      throw new Error("La factura sustituta debe estar timbrada antes de solicitar cancelación 01 o 04.");
    }
    substitutionDocId = subDoc.id;
  }

  const updated = await prisma.billingDocument.update({
    where: { id: doc.id },
    data: {
      cancelRequestedAt: new Date(),
      cancelRequestedByUserId: actor.userId,
      cancelAuthorizedByUserId: null,
      cancelMotive: input.motive,
      cancelSubstitutionDocId: substitutionDocId,
      cancellationStatus: "none",
    },
  });

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: doc.id,
    action: "SOLICITUD_CANCELACION",
    summary: `Solicitud de cancelación para ${doc.folio} (motivo SAT ${input.motive}). Requiere autorización de CEO o Administrador.`,
    authorUserId: actor.userId,
  });

  return updated;
}

export async function authorizeDocumentCancellation(actor: Actor, documentId: string) {
  if (actor.role !== "CEO" && actor.role !== "ADMINISTRADOR") {
    throw new Error("Solo el CEO o Administrador puede autorizar la cancelación fiscal.");
  }
  const doc = await prisma.billingDocument.findFirst({
    where: { id: documentId, companyId: actor.activeCompanyId },
  });
  if (!doc) throw new Error("No se encontró el documento en esta empresa.");
  if (!doc.cancelRequestedAt || !doc.cancelMotive) {
    throw new Error("Primero debe registrarse la solicitud y motivo de cancelación.");
  }
  if (doc.status === "CANCELADA") throw new Error("Este documento ya está cancelado.");

  const updated = await prisma.billingDocument.update({
    where: { id: doc.id },
    data: { cancelAuthorizedByUserId: actor.userId },
  });

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: doc.id,
    action: "AUTORIZACION_CANCELACION",
    summary: `Cancelación fiscal de ${doc.folio} autorizada (motivo ${doc.cancelMotive}). Lista para ejecutar ante SAT.`,
    authorUserId: actor.userId,
  });

  return updated;
}

export async function executeDocumentCancellation(
  actor: Actor,
  documentId: string,
  options?: { fetchFn?: typeof fetch },
) {
  if (
    actor.role !== "COORDINACION_ADMINISTRACION"
    && actor.role !== "CEO"
    && actor.role !== "ADMINISTRADOR"
  ) {
    throw new Error("Solo Coordinación, CEO o Administrador pueden ejecutar la cancelación fiscal.");
  }
  const doc = await prisma.billingDocument.findFirst({
    where: { id: documentId, companyId: actor.activeCompanyId },
  });
  if (!doc) throw new Error("No se encontró el documento en esta empresa.");
  if (!doc.cancelRequestedAt || !doc.cancelAuthorizedByUserId) {
    throw new Error("La cancelación debe estar solicitada y autorizada por CEO o Administrador antes de ejecutarse.");
  }

  return cancelBillingDocumentInFacturapi(doc.id, {
    actorUserId: actor.userId,
    fetchFn: options?.fetchFn,
  });
}

export async function authorizeAndExecuteDocumentCancellation(
  actor: Actor,
  documentId: string,
  options?: { fetchFn?: typeof fetch },
) {
  await authorizeDocumentCancellation(actor, documentId);
  return executeDocumentCancellation(actor, documentId, options);
}

/** Importe con IVA sugerido para acreditar una partida, sin pasar del saldo acreditable. */
export function creditNoteAmountForLine(
  line: { amount: number; taxability: string | null; taxIncluded: boolean },
  remaining: number,
) {
  const exempt = line.taxIncluded || line.taxability === "01" || line.taxability === "03";
  const gross = exempt ? line.amount : roundMoney(line.amount * 1.16);
  return roundMoney(Math.min(Math.max(gross, 0), Math.max(remaining, 0)));
}

export async function issueCreditNote(
  actor: Actor,
  targetDocumentId: string,
  input: {
    concept: string;
    amount: number;
    cfdiUse?: string | null;
    paymentForm?: string | null;
  },
  options?: { fetchFn?: typeof fetch },
) {
  if (
    actor.role !== "ADMINISTRADOR"
    && actor.role !== "CEO"
    && actor.role !== "COORDINACION_ADMINISTRACION"
  ) {
    throw new Error("Solo Coordinación, CEO o Administrador pueden emitir notas de crédito.");
  }

  const target = await prisma.billingDocument.findFirst({
    where: { id: targetDocumentId, companyId: actor.activeCompanyId },
    include: {
      client: true,
      company: true,
      lines: true,
      receivable: true,
      payable: true,
      creditNotes: { where: { kind: "NOTA_CREDITO", status: { not: "CANCELADA" } } },
    },
  });

  if (!target) throw new Error("No se encontró la factura origen en esta empresa.");
  if (target.kind === "REMISION" || target.kind === "NOTA_CREDITO" || target.status !== "EMITIDA") {
    throw new Error("La nota de crédito solo puede emitirse sobre una factura emitida.");
  }

  const sandboxActive = await inSandbox();
  if (!sandboxActive && target.fiscalStatus !== "TIMBRADA") {
    throw new Error("La factura origen debe estar timbrada antes de emitir una nota de crédito.");
  }
  if (!sandboxActive && !target.fiscalUuid) {
    throw new Error("La factura origen no tiene UUID fiscal.");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("El importe de la nota de crédito debe ser mayor a cero.");
  }

  const total = roundMoney(input.amount);
  const alreadyCredited = roundMoney(target.creditNotes.reduce((sum, nc) => sum + nc.total, 0));
  const maxCreditable = roundMoney(target.total - alreadyCredited);
  if (total > maxCreditable) {
    throw new Error(`El importe excede el saldo acreditable disponible (${maxCreditable}).`);
  }

  const concept = input.concept.trim();
  if (!concept) throw new Error("El concepto de la nota de crédito es obligatorio.");

  const subtotal = roundMoney(total / 1.16);
  const iva = roundMoney(total - subtotal);
  const folio = await allocateFolio(actor.activeCompanyId, "NC");
  const issuedAt = new Date();
  const cfdiUse = input.cfdiUse?.trim() || "G02";
  const paymentMethod = "PUE";
  const paymentForm = resolvePaymentFormForDocument(paymentMethod, input.paymentForm ?? target.paymentFormSnapshot);

  const fiscalConfig = parseCompanyFiscalConfig(target.company);
  const satDefaults = resolveSatDefaultsForDocument(fiscalConfig, {
    companyCode: target.company.code,
    documentKind: target.kind,
  });
  const baseLine = target.lines[0];

  const creditNote = await prisma.$transaction(async (tx) => {
    const created = await tx.billingDocument.create({
      data: {
        folio,
        companyId: actor.activeCompanyId,
        kind: "NOTA_CREDITO",
        status: "EMITIDA",
        clientId: target.clientId,
        relatedDocumentId: target.id,
        satRelationType: "01",
        concept,
        subtotal,
        iva,
        total,
        creditDays: 0,
        rfcSnapshot: target.rfcSnapshot || target.client.rfc,
        cfdiUseSnapshot: cfdiUse,
        paymentMethodSnapshot: paymentMethod,
        paymentFormSnapshot: paymentForm,
        issuedAt,
        dueAt: issuedAt,
        fiscalStatus: "PENDIENTE",
        requestedByUserId: actor.userId,
        issuedByUserId: actor.userId,
        lines: {
          create: [
            {
              concept,
              quantity: 1,
              unitPrice: subtotal,
              discountAmount: 0,
              amount: subtotal,
              taxIncluded: false,
              satProductKey: baseLine?.satProductKey || satDefaults.productKey,
              satUnitKey: baseLine?.satUnitKey || satDefaults.unitKey,
              satUnitName: baseLine?.satUnitName || satDefaults.unitName,
              taxability: baseLine?.taxability || satDefaults.taxability,
            },
          ],
        },
      },
    });

    if (target.receivable && target.receivable.status !== "CANCELADA" && target.receivable.balance > 0) {
      const reduction = Math.min(target.receivable.balance, total);
      const nextBal = roundMoney(target.receivable.balance - reduction);
      await tx.receivable.update({
        where: { id: target.receivable.id },
        data: { balance: nextBal, status: balanceStatus(nextBal, target.receivable.amount) },
      });
    }

    if (target.payable && target.payable.status !== "CANCELADA" && target.payable.balance > 0) {
      const reductionP = Math.min(target.payable.balance, total);
      const nextBalP = roundMoney(target.payable.balance - reductionP);
      await tx.payable.update({
        where: { id: target.payable.id },
        data: { balance: nextBalP, status: balanceStatus(nextBalP, target.payable.amount) },
      });
    }

    return created;
  });

  try {
    await stampBillingDocument(creditNote.id, { fetchFn: options?.fetchFn });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado al timbrar Nota de Crédito.";
    await prisma.billingDocument
      .update({
        where: { id: creditNote.id },
        data: { fiscalStatus: "ERROR", fiscalError: `${message} El reintento usa este mismo documento.` },
      })
      .catch(() => undefined);
  }

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: creditNote.id,
    action: "EMISION_NOTA_CREDITO",
    summary: `Nota de crédito ${folio} emitida sobre ${target.folio} por ${total} (relación 01).`,
    authorUserId: actor.userId,
  });

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: target.id,
    action: "NOTA_CREDITO_APLICADA",
    summary: `Se aplicó nota de crédito ${folio} por ${total} a ${target.folio}.`,
    authorUserId: actor.userId,
  });

  return creditNote;
}

export async function patchBillingLineSatKeys(
  actor: Actor,
  input: { documentId: string; lineId: string; satProductKey: string; satUnitKey: string },
) {
  const document = await prisma.billingDocument.findFirst({
    where: { id: input.documentId, companyId: actor.activeCompanyId },
    include: {
      client: { select: { ownerUserId: true } },
      lines: { where: { id: input.lineId } },
    },
  });
  if (!document) throw new Error("Documento no encontrado en esta empresa.");
  if (actor.role === "VENTAS") {
    throw new Error("Los vendedores no pueden editar claves SAT en facturación.");
  }
  if (!billingLineSatKeysEditable(document)) {
    throw new Error("Las claves SAT de esta línea ya no se pueden editar.");
  }
  const line = document.lines[0];
  if (!line) throw new Error("Línea de facturación no encontrada.");

  const satProductKey = parseSatProductKey(input.satProductKey);
  const satUnitKey = parseSatUnitKey(input.satUnitKey);
  const satUnitName = resolveSatUnitName(satUnitKey);

  await prisma.billingLine.update({
    where: { id: line.id },
    data: { satProductKey, satUnitKey, satUnitName },
  });

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "DOCUMENTO",
    entityId: document.id,
    action: "ACTUALIZACION",
    summary: `Claves SAT actualizadas en línea «${line.concept}»: prod. ${satProductKey}, unidad ${satUnitKey}.`,
    authorUserId: actor.userId,
  });
}
