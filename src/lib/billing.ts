import { prisma } from "./db";
import { allocateFolio } from "./folios";
import { recordCompanyCash } from "./purchases";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { linesForTotal, quoteTotals, roundMoney } from "./money";
import type { Role } from "./roles";

type Actor = { userId: string; role: Role; activeCompanyId: string; activeCompanyCode: string };

const CASH_INVOICE_LIMIT = 2000;

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

export async function requestFromQuote(actor: Actor, quoteId: string, kind: "FACTURA" | "REMISION", amount: number | null) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId },
    include: { lines: true, client: true },
  });
  if (!quote || quote.status !== "AUTORIZADA") throw new Error("Solo se solicita documento de una cotización autorizada.");
  if (actor.role === "VENTAS" && quote.sellerUserId !== actor.userId) throw new Error("Esa cotización no está en tu cartera.");
  const totals = quoteTotals(linesForTotal(quote.lines, quote.quoteType, quote.status), quote.discountPct);
  if (!totals) throw new Error("La cotización no tiene importe.");
  const used = await invoicedTotal(quote.id);
  const remaining = roundMoney(totals.total - used);
  if (remaining <= 0 && kind === "FACTURA") throw new Error("Esa operación ya no tiene saldo por facturar.");
  const total = kind === "REMISION" && (amount == null || amount === 0) ? 0 : roundMoney(amount ?? remaining);
  if (kind === "FACTURA" && (total <= 0 || total > remaining)) throw new Error("El importe no puede exceder el saldo permitido.");
  const ratio = totals.total === 0 ? 0 : total / totals.total;
  const subtotal = roundMoney(totals.subtotal * ratio);
  const iva = roundMoney(total - subtotal);
  const folio = await allocateFolio(actor.activeCompanyId, kind === "REMISION" ? "REM" : "FAC");
  const concept = quote.lines.filter((line) => line.authorized || quote.quoteType !== "VENTA_EQUIPO").map((line) => line.concept).join("; ") || quote.folio;
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
}

export async function issueDocument(actor: Actor, documentId: string) {
  const document = await prisma.billingDocument.findFirst({
    where: { id: documentId, companyId: actor.activeCompanyId },
    include: { client: true, receivable: true },
  });
  if (!document || document.status !== "SOLICITADA") throw new Error("Ese documento no está pendiente de emisión.");
  if (document.receivable) throw new Error("Ese documento ya generó una cuenta por cobrar.");
  const issuedAt = new Date();
  const dueAt = addDays(issuedAt, document.creditDays);
  const fiscal = document.kind === "REMISION"
    ? { fiscalStatus: "NO_APLICA", fiscalError: null as string | null, status: "EMITIDA" }
    : { fiscalStatus: "ERROR", fiscalError: "Facturapi no está configurado. El reintento usa este mismo documento.", status: "EMITIDA" };
  await prisma.billingDocument.update({
    where: { id: document.id },
    data: { ...fiscal, issuedAt, dueAt, issuedByUserId: actor.userId, version: { increment: 1 } },
  });
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
    const supplier = await prisma.supplier.findUnique({ where: { id: "supplier-intercompany-servomotores" } });
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

export async function retryFiscal(actor: Actor, documentId: string) {
  const document = await prisma.billingDocument.findFirst({ where: { id: documentId, companyId: actor.activeCompanyId } });
  if (!document || document.fiscalStatus !== "ERROR") throw new Error("Ese documento no tiene un timbrado por reintentar.");
  await prisma.billingDocument.update({
    where: { id: document.id },
    data: { fiscalError: "Facturapi no está configurado. El reintento no creó otro documento.", version: { increment: 1 } },
  });
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
      fiscalStatus: "ERROR",
      fiscalError: "Facturapi no está configurado. El reintento usa este mismo documento.",
      issuedByUserId: actor.userId,
      lines: { create: [{ concept: input.concept, quantity: 1, unitPrice: total, amount: total }] },
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

export async function requestIntercompany(actor: Actor, quoteId: string) {
  if (actor.activeCompanyCode !== "SERVOMOTORES") throw new Error("La factura a SYSTRON se solicita en Servomotores.");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId, status: "AUTORIZADA" },
    include: { lines: true, client: true },
  });
  if (!quote || !quote.client.isSystem) throw new Error("La base autorizada de Servomotores a SYSTRON es la que se factura.");
  const existing = await prisma.billingDocument.findFirst({
    where: { quoteId: quote.id, kind: "FACTURA_INTERCOMPANIA", status: { not: "CANCELADA" } },
  });
  if (existing) return existing;
  const totals = quoteTotals(quote.lines, quote.discountPct);
  if (!totals || totals.total <= 0) throw new Error("La cotización base no tiene importe.");
  const folio = await allocateFolio(actor.activeCompanyId, "FAC");
  const document = await prisma.billingDocument.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      kind: "FACTURA_INTERCOMPANIA",
      status: "SOLICITADA",
      clientId: quote.clientId,
      quoteId: quote.id,
      technicalCaseId: quote.technicalCaseId,
      equipmentId: quote.equipmentId,
      concept: quote.lines.map((line) => line.concept).join("; "),
      subtotal: totals.subtotal,
      iva: totals.iva,
      total: totals.total,
      creditDays: quote.creditDays ?? quote.client.creditDays ?? 0,
      rfcSnapshot: quote.client.rfc,
      fiscalStatus: "PENDIENTE",
      requestedByUserId: actor.userId,
      lines: { create: quote.lines.map((line) => ({ concept: line.concept, quantity: line.quantity, unitPrice: line.unitPrice ?? 0, amount: roundMoney(line.quantity * (line.unitPrice ?? 0)) })) },
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
  if (actor.role === "VENTAS" && row.sellerUserId !== actor.userId) throw new Error("Esa cartera no es tuya.");
  await prisma.collectionNote.create({
    data: { receivableId: row.id, note, followUpAt, authorUserId: actor.userId },
  });
}
