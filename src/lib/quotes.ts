import { prisma } from "./db";
import { allocateFolio } from "./folios";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { finalFromBase } from "./money";
import type { Role } from "./roles";

export const QUOTE_TYPES = ["DIAGNOSTICO", "REPARACION", "CAMPO", "VENTA_EQUIPO"] as const;
export type QuoteType = (typeof QUOTE_TYPES)[number];

export const QUOTE_TYPE_LABEL: Record<QuoteType, string> = {
  DIAGNOSTICO: "Diagnóstico",
  REPARACION: "Reparación/Servicio",
  CAMPO: "Servicio en campo",
  VENTA_EQUIPO: "Venta de equipo",
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  PENDIENTE_COTIZAR: "Pendiente de cotizar",
  PENDIENTE_DECISION: "Pendiente de decisión",
  AUTORIZADA: "Autorizada",
  NO_AUTORIZADA: "No autorizada",
  AUTORIZADA_PENDIENTE_EQUIPO: "Autorizada — pendiente de ingreso de equipo",
};

type Actor = { userId: string; role: Role; activeCompanyId: string; activeCompanyCode: string };

export function seesEconomicDetail(role: Role, companyCode: string, quoteCompanyCode: string, isBaseForOther: boolean): boolean {
  if (role === "VENTAS") return false;
  if (companyCode === "SERVOMOTORES" && quoteCompanyCode === "SYSTRON") return false;
  if (role === "GERENTE_OPERATIVO_SERVOMOTORES" && isBaseForOther) return true;
  return role === "ADMINISTRADOR" || role === "CEO" || role === "COORDINACION_ADMINISTRACION" || role === "GERENTE_OPERATIVO_SERVOMOTORES";
}

export async function createSellerQuote(
  actor: Actor,
  input: {
    clientId: string;
    quoteType: QuoteType;
    equipmentId: string | null;
    preliminaryType: string | null;
    preliminaryBrand: string | null;
    preliminaryModel: string | null;
    preliminarySerial: string | null;
    reference: string | null;
    concepts: Array<{ concept: string; quantity: number }>;
    contactIds: string[];
  },
) {
  if (input.concepts.length === 0) throw new Error("Agrega al menos un concepto.");
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, companyId: actor.activeCompanyId, active: true, isSystem: false },
  });
  if (!client) throw new Error("Selecciona un cliente activo de esta empresa.");
  if (actor.role === "VENTAS" && client.ownerUserId !== actor.userId) throw new Error("Ese cliente no está en tu cartera.");
  if (input.equipmentId) {
    const equipment = await prisma.equipment.findFirst({ where: { id: input.equipmentId, originCompanyId: actor.activeCompanyId } });
    if (!equipment) throw new Error("El equipo no pertenece a esta empresa.");
  } else if (input.quoteType !== "CAMPO" && input.quoteType !== "VENTA_EQUIPO") {
    if (!input.preliminaryType || !input.preliminaryBrand || !input.preliminaryModel) {
      throw new Error("Sin equipo físico hay que capturar tipo, marca y modelo preliminares.");
    }
  }
  if (input.contactIds.length === 0) throw new Error("Selecciona al menos un contacto.");
  const contacts = await prisma.contact.count({ where: { id: { in: input.contactIds }, clientId: client.id, active: true } });
  if (contacts !== input.contactIds.length) throw new Error("Algún contacto no pertenece al cliente.");
  const folio = await allocateFolio(actor.activeCompanyId, "COT");
  const quote = await prisma.quote.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      clientId: client.id,
      quoteType: input.quoteType,
      status: "PENDIENTE_COTIZAR",
      equipmentId: input.equipmentId,
      preliminaryType: input.preliminaryType,
      preliminaryBrand: input.preliminaryBrand,
      preliminaryModel: input.preliminaryModel,
      preliminarySerial: input.preliminarySerial,
      reference: input.reference,
      sellerUserId: actor.role === "VENTAS" || actor.role === "GERENTE_OPERATIVO_SERVOMOTORES" ? actor.userId : client.ownerUserId,
      lines: { create: input.concepts.map((line) => ({ concept: line.concept, quantity: line.quantity })) },
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "ALTA",
    summary: `${folio} quedó pendiente de cotizar. Los contactos elegidos se usan al dar seguimiento.`,
    authorUserId: actor.userId,
  });
  return quote;
}

export async function prepareQuoteFromCase(actor: Actor, caseId: string) {
  const existing = await prisma.quote.findFirst({ where: { technicalCaseId: caseId, companyId: actor.activeCompanyId } });
  if (existing) return existing;
  const row = await prisma.technicalCase.findUnique({
    where: { id: caseId },
    include: { attention: true, equipment: true, serviceCompany: true },
  });
  if (!row?.quotePending) throw new Error("Esta operación no está pendiente de cotizar.");
  const clientId = row.attention.adminClientId;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Falta el cliente de la cotización.");
  const folio = await allocateFolio(actor.activeCompanyId, "COT");
  const repair = row.kind === "OS";
  const quote = await prisma.quote.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      clientId,
      quoteType: repair ? "REPARACION" : "DIAGNOSTICO",
      status: "PENDIENTE_COTIZAR",
      equipmentId: row.equipmentId,
      technicalCaseId: row.id,
      sellerUserId: row.attention.sellerUserId,
      lines: {
        create: [{
          concept: row.attention.reportedFault,
          quantity: 1,
          incrementPct: repair ? row.attention.priorityIncrementPct : null,
          unitPrice: repair ? null : row.attention.priorityPrice,
        }],
      },
    },
  });
  if (!repair && row.attention.priorityPrice != null) {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "PENDIENTE_DECISION" } });
  }
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "ALTA",
    summary: `${folio} preparada desde ${row.folio}.`,
    authorUserId: actor.userId,
  });
  return quote;
}

export async function setPrices(
  actor: Actor,
  quoteId: string,
  version: number,
  prices: Array<{ lineId: string; amount: number }>,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId },
    include: { lines: true, company: true },
  });
  if (!quote || quote.status !== "PENDIENTE_COTIZAR") throw new Error("Esta cotización no admite precio.");
  await prisma.$transaction(async (tx) => {
    for (const price of prices) {
      const line = quote.lines.find((item) => item.id === price.lineId);
      if (!line) throw new Error("Hay un concepto que no pertenece a la cotización.");
      if (!Number.isFinite(price.amount) || price.amount < 0) throw new Error("El precio no es válido.");
      const increment = line.incrementPct;
      await tx.quoteLine.update({
        where: { id: line.id },
        data: increment != null
          ? { basePrice: price.amount, unitPrice: finalFromBase(price.amount, increment) }
          : { unitPrice: price.amount, basePrice: null },
      });
    }
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, version },
      data: { status: "PENDIENTE_DECISION", creditDays: quote.creditDays, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "PRECIO",
    summary: "Precio asignado. Pasa a pendiente de decisión.",
    authorUserId: actor.userId,
  });
}

export async function applyDiscount(actor: Actor, quoteId: string, version: number, discountPct: number) {
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) throw new Error("El descuento no es válido.");
  if (actor.role === "VENTAS") {
    const user = await prisma.user.findUnique({ where: { id: actor.userId } });
    const limit = user?.discountLimitPct ?? 0;
    if (discountPct > limit) throw new Error(`Tu límite de descuento es ${limit}%.`);
  }
  const updated = await prisma.quote.updateMany({
    where: { id: quoteId, companyId: actor.activeCompanyId, status: "PENDIENTE_DECISION", version },
    data: { discountPct, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
}

export async function decideQuote(
  actor: Actor,
  quoteId: string,
  version: number,
  authorized: boolean,
  lineIds: string[],
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId },
    include: { lines: true, client: true },
  });
  if (!quote || quote.status !== "PENDIENTE_DECISION") throw new Error("La cotización no está pendiente de decisión.");
  if (quote.lines.some((line) => line.unitPrice == null)) throw new Error("Falta el precio.");
  const chosen = authorized ? quote.lines.filter((line) => quote.quoteType !== "VENTA_EQUIPO" || lineIds.includes(line.id)) : [];
  if (authorized && chosen.length === 0) throw new Error("Selecciona al menos una línea autorizada.");
  const needsEquipment = authorized && !quote.equipmentId && (quote.quoteType === "DIAGNOSTICO" || quote.quoteType === "REPARACION");
  const status = !authorized ? "NO_AUTORIZADA" : needsEquipment ? "AUTORIZADA_PENDIENTE_EQUIPO" : "AUTORIZADA";
  const creditDays = quote.client.creditDays;
  const saleFolio = status === "AUTORIZADA" && quote.quoteType === "VENTA_EQUIPO" ? await allocateFolio(quote.companyId, "VTA") : null;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, version },
      data: { status, creditDays, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await tx.quoteLine.updateMany({ where: { quoteId: quote.id }, data: { authorized: false } });
    if (chosen.length > 0) {
      await tx.quoteLine.updateMany({ where: { id: { in: chosen.map((line) => line.id) } }, data: { authorized: true } });
    }
    if (saleFolio) {
      await tx.sale.create({
        data: {
          folio: saleFolio,
          companyId: quote.companyId,
          clientId: quote.clientId,
          quoteId: quote.id,
          lines: { create: chosen.map((line) => ({ concept: line.concept, qtySold: line.quantity })) },
        },
      });
    }
    if (quote.linkedQuoteId) {
      await tx.quote.updateMany({
        where: { id: quote.linkedQuoteId },
        data: { status: authorized ? "AUTORIZADA" : "NO_AUTORIZADA", version: { increment: 1 } },
      });
    }
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "DECISION",
    summary: authorized ? `Decisión: ${status}. El crédito queda congelado.` : "El cliente no autorizó. Se conserva el historial.",
    authorUserId: actor.userId,
  });
}

export async function linkIntercompanyQuote(actor: Actor, baseQuoteId: string, customerQuoteId: string) {
  if (actor.activeCompanyCode !== "SYSTRON") throw new Error("La cotización final al cliente se liga desde SYSTRON.");
  const base = await prisma.quote.findUnique({ where: { id: baseQuoteId }, include: { company: true, client: true } });
  const customer = await prisma.quote.findFirst({ where: { id: customerQuoteId, companyId: actor.activeCompanyId } });
  if (!base || base.company.code !== "SERVOMOTORES" || !base.client.isSystem) throw new Error("La base debe ser la cotización de Servomotores a SYSTRON.");
  if (!customer) throw new Error("La cotización del cliente no está en SYSTRON.");
  await prisma.quote.update({ where: { id: customer.id }, data: { linkedQuoteId: base.id, version: { increment: 1 } } });
}

export async function receiveSaleLine(actor: Actor, lineId: string, quantity: number) {
  const line = await prisma.saleLine.findUnique({ where: { id: lineId }, include: { sale: true } });
  if (!line || line.sale.companyId !== actor.activeCompanyId) throw new Error("La línea no es de esta empresa.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("La cantidad recibida no es válida.");
  if (line.qtyReceived + quantity > line.qtySold) throw new Error("No se puede recibir más de lo vendido.");
  await prisma.saleLine.update({ where: { id: line.id }, data: { qtyReceived: line.qtyReceived + quantity } });
}

export async function deliverSaleLine(actor: Actor, lineId: string, quantity: number) {
  const line = await prisma.saleLine.findUnique({ where: { id: lineId }, include: { sale: true } });
  if (!line || line.sale.companyId !== actor.activeCompanyId) throw new Error("La línea no es de esta empresa.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("La cantidad entregada no es válida.");
  const available = line.qtyReceived - line.qtyDelivered;
  if (quantity > available) throw new Error("Solo se entrega lo que ya se recibió y aún no se entregó.");
  await prisma.saleLine.update({ where: { id: line.id }, data: { qtyDelivered: line.qtyDelivered + quantity } });
}
