import { prisma } from "./db";
import {
  allocateFolio,
  allocateServiceNumber,
  ensureAttentionServiceNumber,
  formatServiceFolio,
  serviceCycleNumberFromFolio,
  serviceFolioForAttention,
} from "./folios";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { ensureOsStubForDiagnosis } from "./technical";
import { finalFromBase } from "./money";
import { ATTENTION_LABEL, isReparacionExpressAttentionType, type AttentionType } from "./priorities";
import { ensureReparacionTallerPriorities } from "./priority-catalog";
import { commercialSellerQuoteConcept, technicalServiceConcept } from "./quote-concept";
import { commercialQuoteSeriesForType, isCotosQuote, isSellerCommercialQuote } from "./quote-folio-series";
import { createFieldServiceCaseFromQuote, FIELD_SERVICE_DEFAULT_HOURS, parseFieldServicePricing } from "./field-service";
import type { Role } from "./roles";
import { QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, QUOTE_TYPES, type QuoteType } from "./quote-meta";
import { SALES_NOT_ASSIGNED_MESSAGE } from "./sales-assignment";
import { addBusinessDays, normalizeSlaStartFromAuthorization } from "./sla";

export { QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, QUOTE_TYPES, type QuoteType };

type Actor = { userId: string; role: Role; activeCompanyId: string; activeCompanyCode: string };

/** Tipo de atención al abrir operación desde cotización comercial del vendedor. */
export function commercialAttentionTypeForQuote(quote: {
  quoteType: string;
  folio: string;
  technicalCaseId: string | null;
}): AttentionType {
  if (quote.quoteType === "DIAGNOSTICO") return "DIAGNOSTICO";
  if (isCotosQuote(quote)) return "REPARACION_TALLER";
  if (quote.quoteType === "REPARACION") return "REPARACION";
  return "DIAGNOSTICO";
}

/** Tras ingreso en almacén: COTDX liga al DX; COTOS al OS (no al stub reservado del ciclo DX). */
export function commercialCaseKindForQuote(quote: {
  quoteType: string;
  folio: string;
  technicalCaseId: string | null;
}): "DIAGNOSTICO" | "OS" {
  if (isCotosQuote(quote)) return "OS";
  if (quote.quoteType === "DIAGNOSTICO" && isSellerCommercialQuote(quote)) return "DIAGNOSTICO";
  return quote.quoteType === "REPARACION" ? "OS" : "DIAGNOSTICO";
}

export function pickCommercialCaseForAttention(
  quote: { quoteType: string; folio: string; technicalCaseId: string | null },
  cases: Array<{ id: string; kind: string }>,
) {
  const kind = commercialCaseKindForQuote(quote);
  return cases.find((row) => row.kind === kind) ?? null;
}

async function freezePriorityFromCatalog(
  companyId: string,
  attentionType: AttentionType,
  priorityId: string,
) {
  await ensureReparacionTallerPriorities(companyId);
  const priority = await prisma.priority.findFirst({
    where: { id: priorityId, companyId, attentionType, active: true },
  });
  if (!priority) throw new Error("Selecciona una prioridad vigente de este servicio.");
  return priority;
}

function frozenPriorityFromQuote(quote: {
  priorityName: string | null;
  priorityPrice: number | null;
  priorityIncrementPct: number | null;
  priorityTargetMinDays: number | null;
  priorityTargetMaxDays: number | null;
  prioritySlaMaxDays: number | null;
}) {
  if (!quote.priorityName || quote.prioritySlaMaxDays == null) return null;
  return {
    name: quote.priorityName,
    price: quote.priorityPrice,
    incrementPct: quote.priorityIncrementPct,
    targetMinDays: quote.priorityTargetMinDays,
    targetMaxDays: quote.priorityTargetMaxDays,
    slaMaxDays: quote.prioritySlaMaxDays,
  };
}

type AttentionPriorityFreeze = {
  priorityName: string;
  priorityPrice: number | null;
  priorityIncrementPct: number | null;
  priorityTargetMin: number | null;
  priorityTargetMax: number | null;
  prioritySlaMaxDays: number | null;
};

function frozenPriorityFieldsFromAttention(attention: AttentionPriorityFreeze) {
  const deliveryDefault = attention.prioritySlaMaxDays ?? attention.priorityTargetMax ?? null;
  return {
    priorityName: attention.priorityName,
    priorityPrice: attention.priorityPrice,
    priorityIncrementPct: attention.priorityIncrementPct,
    priorityTargetMinDays: attention.priorityTargetMin,
    priorityTargetMaxDays: attention.priorityTargetMax,
    prioritySlaMaxDays: attention.prioritySlaMaxDays,
    ...(deliveryDefault != null && deliveryDefault >= 1 ? { deliveryBusinessDays: deliveryDefault } : {}),
  };
}

/** Precio referencia Servomotores (Diego) para que el CEO SYSTRON fije precio comercial. */
export function intercompanyReferenceAmount(
  baseQuote: { lines: Array<{ unitPrice: number | null; basePrice: number | null }> } | null | undefined,
  attention: { priorityPrice: number | null } | null | undefined,
): number | null {
  const pricedLine = baseQuote?.lines.find((line) => line.unitPrice != null || line.basePrice != null);
  if (pricedLine) return pricedLine.basePrice ?? pricedLine.unitPrice;
  return attention?.priorityPrice ?? null;
}

export function intercompanyDeliveryDaysDefault(quote: {
  deliveryBusinessDays: number | null;
  prioritySlaMaxDays: number | null;
  priorityTargetMaxDays: number | null;
}): number | "" {
  if (quote.deliveryBusinessDays != null) return quote.deliveryBusinessDays;
  if (quote.prioritySlaMaxDays != null && quote.prioritySlaMaxDays >= 1) return quote.prioritySlaMaxDays;
  if (quote.priorityTargetMaxDays != null && quote.priorityTargetMaxDays >= 1) return quote.priorityTargetMaxDays;
  return "";
}

export function seesEconomicDetail(role: Role, companyCode: string, quoteCompanyCode: string, isBaseForOther: boolean): boolean {
  if (role === "VENTAS") return false;
  if (companyCode === "SERVOMOTORES" && quoteCompanyCode === "SYSTRON") return false;
  if (role === "GERENTE_OPERATIVO_SERVOMOTORES" && isBaseForOther) return true;
  return role === "ADMINISTRADOR" || role === "CEO" || role === "COORDINACION_ADMINISTRACION" || role === "GERENTE_OPERATIVO_SERVOMOTORES";
}

function automaticQuoteConcept(row: {
  equipment: { typeName: string | null; brandName: string | null; model: string | null; serial: string | null };
}) {
  return technicalServiceConcept(row.equipment);
}

function resolveQuoteSellerUserId(attentionSellerUserId: string | null, clientOwnerUserId: string | null) {
  return attentionSellerUserId ?? clientOwnerUserId;
}

async function serviceCompanyForEquipment(equipment: { kind: string }, activeCompanyId: string) {
  if (equipment.kind === "MOT") {
    const service = await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } });
    if (!service) throw new Error("No está definida la empresa que ejecuta el servicio.");
    return service;
  }
  const service = await prisma.company.findUnique({ where: { id: activeCompanyId } });
  if (!service) throw new Error("No está definida la empresa que ejecuta el servicio.");
  return service;
}

/** Reserva SRV al alta comercial COTDX/COTOS; idempotente si ya existe. */
export async function ensureQuoteWorkshopSrvReservation(
  quote: {
    id: string;
    quoteType: string;
    folio: string;
    equipmentId: string | null;
    technicalCaseId: string | null;
    reservedServiceNumber: number | null;
  },
  activeCompanyId: string,
): Promise<number | null> {
  if (quote.reservedServiceNumber != null) return quote.reservedServiceNumber;
  if (quote.technicalCaseId != null) return null;
  if (quote.quoteType !== "DIAGNOSTICO" && !isCotosQuote(quote)) return null;
  if (!quote.equipmentId) return null;
  const equipment = await prisma.equipment.findUnique({
    where: { id: quote.equipmentId },
    select: { kind: true },
  });
  if (!equipment) return null;
  const service = await serviceCompanyForEquipment(equipment, activeCompanyId);
  const reservedServiceNumber = await allocateServiceNumber(service.id);
  await prisma.quote.update({ where: { id: quote.id }, data: { reservedServiceNumber } });
  return reservedServiceNumber;
}

export async function createSellerQuote(
  actor: Actor,
  input: {
    clientId: string;
    quoteType: QuoteType;
    equipmentId: string | null;
    reference: string | null;
    concepts: Array<{ concept: string; quantity: number }>;
    contactIds: string[];
    priorityId?: string | null;
  },
) {
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, companyId: actor.activeCompanyId, active: true, isSystem: false },
  });
  if (!client) throw new Error("Selecciona un cliente activo de esta empresa.");
  if (actor.role === "VENTAS" && client.ownerUserId !== actor.userId) throw new Error(SALES_NOT_ASSIGNED_MESSAGE);
  const equipment = input.equipmentId
    ? await prisma.equipment.findFirst({
        where: { id: input.equipmentId, originCompanyId: actor.activeCompanyId, clientId: client.id },
        select: { typeName: true, brandName: true, model: true, serial: true, kind: true },
      })
    : null;
  if (input.equipmentId && !equipment) throw new Error("Selecciona un equipo de este cliente.");
  if (!input.equipmentId && (input.quoteType === "DIAGNOSTICO" || input.quoteType === "REPARACION")) {
    throw new Error("Selecciona o registra un equipo para esta cotización.");
  }
  const manualConcepts = input.concepts
    .map((line) => ({ concept: line.concept.trim(), quantity: line.quantity }))
    .filter((line) => line.concept.length > 0);
  const concepts =
    manualConcepts.length > 0
      ? manualConcepts
      : [{ concept: commercialSellerQuoteConcept(input.quoteType, equipment), quantity: 1 }];
  let frozenPriority: Awaited<ReturnType<typeof freezePriorityFromCatalog>> | null = null;
  if (input.quoteType === "DIAGNOSTICO") {
    if (!input.priorityId) throw new Error("Selecciona la prioridad del diagnóstico.");
    frozenPriority = await freezePriorityFromCatalog(actor.activeCompanyId, "DIAGNOSTICO", input.priorityId);
  }
  if (input.contactIds.length === 0) throw new Error("Selecciona al menos un contacto.");
  const contacts = await prisma.contact.count({ where: { id: { in: input.contactIds }, clientId: client.id, active: true } });
  if (contacts !== input.contactIds.length) throw new Error("Algún contacto no pertenece al cliente.");
  const sellerUserId =
    actor.role === "VENTAS" || actor.role === "GERENTE_OPERATIVO_SERVOMOTORES"
      ? actor.userId
      : client.ownerUserId;
  if (!sellerUserId) {
    throw new Error("El cliente no tiene vendedor asignado. Asigna un responsable comercial en la ficha del cliente antes de crear la cotización.");
  }
  const folioSeries = commercialQuoteSeriesForType(input.quoteType);
  const folio = await allocateFolio(actor.activeCompanyId, folioSeries);
  let reservedServiceNumber: number | null = null;
  if (equipment && (input.quoteType === "DIAGNOSTICO" || input.quoteType === "REPARACION")) {
    const service = await serviceCompanyForEquipment(equipment, actor.activeCompanyId);
    reservedServiceNumber = await allocateServiceNumber(service.id);
  }
  const quote = await prisma.quote.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      clientId: client.id,
      quoteType: input.quoteType,
      status: "PENDIENTE_COTIZAR",
      equipmentId: input.equipmentId,
      ...(reservedServiceNumber != null ? { reservedServiceNumber } : {}),
      reference: input.reference,
      sellerUserId,
      ...(frozenPriority
        ? {
            priorityName: frozenPriority.name,
            priorityPrice: frozenPriority.price,
            priorityIncrementPct: frozenPriority.incrementPct,
            priorityTargetMinDays: frozenPriority.targetMinDays,
            priorityTargetMaxDays: frozenPriority.targetMaxDays,
            prioritySlaMaxDays: frozenPriority.slaMaxDays,
          }
        : {}),
      lines: { create: concepts.map((line) => ({ concept: line.concept, quantity: line.quantity })) },
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
  return ensureQuoteFromCase(actor, caseId);
}

export async function ensureQuoteFromCase(actor: { userId: string; activeCompanyId: string }, caseId: string) {
  const row = await prisma.technicalCase.findUnique({
    where: { id: caseId },
    include: { attention: true, equipment: true },
  });
  if (!row) throw new Error("No se encontró la operación técnica.");
  const siblingCaseIds = await prisma.technicalCase.findMany({
    where: { attentionId: row.attentionId },
    select: { id: true },
  });
  const existing = await prisma.quote.findFirst({
    where: {
      companyId: actor.activeCompanyId,
      technicalCaseId: { in: siblingCaseIds.map((item) => item.id) },
    },
  });
  if (existing) {
    if (row.equipment.kind === "MOT" && row.equipment.originCompanyId !== actor.activeCompanyId) {
      await ensureOriginQuote(row, existing.id, actor.userId);
    }
    return existing;
  }
  const recoverValidatedDiagnosis =
    row.status === "VALIDADO" && row.kind === "DIAGNOSTICO" && row.attention.attentionType === "DIAGNOSTICO";
  if (!row.quotePending && !recoverValidatedDiagnosis) throw new Error("Esta operación no está pendiente de cotizar.");
  // Recupera diagnósticos validados antes de esta regla, que quedaron sin pendiente comercial.
  if (!row.quotePending) {
    await prisma.technicalCase.update({ where: { id: row.id }, data: { quotePending: true } });
  }
  const clientId = row.equipment.originCompanyId === actor.activeCompanyId ? row.equipment.clientId : row.attention.adminClientId;
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] } },
  });
  if (!client) throw new Error("Falta el cliente de la cotización.");
  const repair = row.kind === "OS";
  const concept = automaticQuoteConcept(row);
  const folio = await serviceFolioForAttention(row.attentionId, row.serviceCompanyId, "COT");
  const quote = await prisma.quote.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      clientId,
      quoteType: repair ? "REPARACION" : "DIAGNOSTICO",
      status: "PENDIENTE_COTIZAR",
      equipmentId: row.equipmentId,
      technicalCaseId: row.id,
      sellerUserId: resolveQuoteSellerUserId(row.attention.sellerUserId, client.ownerUserId),
      reference: row.folio,
      lines: {
        create: [{
          concept,
          quantity: 1,
          incrementPct: repair ? row.attention.priorityIncrementPct : null,
        }],
      },
    },
  });
  const contactNames = client.contacts.map((contact) => contact.name).join(", ");
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "ALTA",
    summary: contactNames
      ? `${folio} quedó pendiente de cotizar desde ${row.folio}. Contactos: ${contactNames}.`
      : `${folio} quedó pendiente de cotizar desde ${row.folio}. El cliente no tiene contactos activos.`,
    authorUserId: actor.userId,
  });
  if (row.equipment.kind === "MOT" && row.equipment.originCompanyId !== actor.activeCompanyId) {
    await ensureOriginQuote(row, quote.id, actor.userId);
  }
  return quote;
}

async function ensureOriginQuote(
  row: {
    id: string;
    attentionId: string;
    serviceCompanyId: string;
    folio: string;
    kind: string;
    equipmentId: string;
    resultText: string | null;
    attention: AttentionPriorityFreeze & { attentionType: string; reportedFault: string; sellerUserId: string | null };
    equipment: { originCompanyId: string; clientId: string; typeName: string | null; brandName: string | null; model: string | null; serial: string | null };
  },
  baseQuoteId: string,
  authorUserId: string,
) {
  const siblingCaseIds = await prisma.technicalCase.findMany({
    where: { attentionId: row.attentionId },
    select: { id: true },
  });
  const existing = await prisma.quote.findFirst({
    where: {
      companyId: row.equipment.originCompanyId,
      OR: [
        { linkedQuoteId: baseQuoteId },
        { technicalCaseId: { in: siblingCaseIds.map((item) => item.id) } },
      ],
    },
  });
  if (existing) return existing;
  const repair = row.kind === "OS";
  const concept = automaticQuoteConcept(row);
  const folio = await serviceFolioForAttention(row.attentionId, row.serviceCompanyId, "COT");
  const originClient = await prisma.client.findUnique({
    where: { id: row.equipment.clientId },
    select: { ownerUserId: true },
  });
  const priorityFields = frozenPriorityFieldsFromAttention(row.attention);
  const quote = await prisma.quote.create({
    data: {
      folio,
      companyId: row.equipment.originCompanyId,
      clientId: row.equipment.clientId,
      quoteType: repair ? "REPARACION" : "DIAGNOSTICO",
      status: "PENDIENTE_COTIZAR",
      equipmentId: row.equipmentId,
      technicalCaseId: row.id,
      linkedQuoteId: baseQuoteId,
      sellerUserId: resolveQuoteSellerUserId(row.attention.sellerUserId, originClient?.ownerUserId ?? null),
      reference: row.folio,
      ...priorityFields,
      lines: {
        create: [{
          concept,
          quantity: 1,
          incrementPct: repair ? row.attention.priorityIncrementPct : null,
        }],
      },
    },
  });
  await recordHistory({
    companyId: row.equipment.originCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "ALTA",
    summary: `${folio} espejo en SYSTRON desde ${row.folio} (Servomotores). Prioridad ${row.attention.priorityName} congelada; el importe de Diego es solo referencia para CEO.`,
    authorUserId,
  });
  return quote;
}

export function repairOrderSlaDueAt(
  repairQuote: { slaDueAt: Date | null } | null | undefined,
  diagnosisQuote: { slaDueAt: Date | null } | null | undefined,
  diagnosis: { slaDueAt: Date | null },
): Date | null {
  return repairQuote?.slaDueAt ?? diagnosisQuote?.slaDueAt ?? diagnosis.slaDueAt;
}

export function quoteRequiresDeliveryDays(quote: { quoteType: string; technicalCaseId: string | null }) {
  return quote.quoteType === "REPARACION"
    || (quote.quoteType === "DIAGNOSTICO" && quote.technicalCaseId != null);
}

type QuoteCaseContext = { kind: string; attentionType: string } | null | undefined;

/** Reparación Express (OS directa): el CEO puede omitir días hábiles al asignar precio. */
export function quoteDeliveryDaysRequired(
  quote: { quoteType: string; technicalCaseId: string | null },
  caseContext: QuoteCaseContext,
): boolean {
  if (!quoteRequiresDeliveryDays(quote)) return false;
  if (
    quote.quoteType === "REPARACION"
    && caseContext?.kind === "OS"
    && isReparacionExpressAttentionType(caseContext.attentionType)
  ) {
    return false;
  }
  return true;
}

export function quoteShowsDeliveryDaysField(
  quote: { quoteType: string; technicalCaseId: string | null },
  caseContext: QuoteCaseContext,
): boolean {
  return quoteDeliveryDaysRequired(quote, caseContext)
    || (
      quote.quoteType === "REPARACION"
      && caseContext?.kind === "OS"
      && isReparacionExpressAttentionType(caseContext.attentionType)
    );
}

/** Texto de columna SLA en listados de cotizaciones. */
export function quoteListSlaLabel(quote: {
  status: string;
  slaDueAt: Date | null;
  deliveryBusinessDays: number | null;
  quoteType: string;
  technicalCaseId: string | null;
}): { kind: "countdown"; dueAt: Date } | { kind: "text"; text: string } {
  if (quote.slaDueAt) {
    return { kind: "countdown", dueAt: quote.slaDueAt };
  }
  if (quote.deliveryBusinessDays != null && quote.deliveryBusinessDays >= 1 && quote.status !== "PENDIENTE_COTIZAR") {
    return { kind: "text", text: `${quote.deliveryBusinessDays} días hábiles` };
  }
  if (quote.status === "PENDIENTE_COTIZAR") {
    return { kind: "text", text: "Sin precio" };
  }
  if (quoteRequiresDeliveryDays(quote) && quote.deliveryBusinessDays == null) {
    return { kind: "text", text: "Sin plazo" };
  }
  return { kind: "text", text: "—" };
}

export function quoteDeliveryEmailNote(quote: {
  quoteType: string;
  technicalCaseId: string | null;
  slaDueAt: Date | null;
  deliveryBusinessDays: number | null;
}): string {
  if (!quoteRequiresDeliveryDays(quote)) return "";
  if (quote.slaDueAt) {
    return ` Fecha de entrega: ${quote.slaDueAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" })}.`;
  }
  if (quote.deliveryBusinessDays) {
    return ` Tiempo de entrega: ${quote.deliveryBusinessDays} días hábiles.`;
  }
  return "";
}

export async function setPrices(
  actor: Actor,
  quoteId: string,
  version: number,
  prices: Array<{ lineId: string; amount: number }>,
  deliveryBusinessDays?: number | null,
  fieldServiceHours?: number | null,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId },
    include: { lines: true, company: true, client: { select: { ownerUserId: true } } },
  });
  if (!quote || quote.status !== "PENDIENTE_COTIZAR") throw new Error("Esta cotización no admite precio.");
  const caseRow = quote.technicalCaseId
    ? await prisma.technicalCase.findUnique({
        where: { id: quote.technicalCaseId },
        select: { kind: true, attention: { select: { attentionType: true } } },
      })
    : null;
  const deliveryRequired = quoteDeliveryDaysRequired(
    quote,
    caseRow ? { kind: caseRow.kind, attentionType: caseRow.attention.attentionType } : null,
  );
  let frozenDeliveryDays: number | undefined;
  if (deliveryRequired) {
    if (!Number.isInteger(deliveryBusinessDays) || deliveryBusinessDays! < 1) {
      throw new Error("Indica el tiempo de entrega en días hábiles (entero mayor o igual a 1).");
    }
    frozenDeliveryDays = deliveryBusinessDays!;
  } else if (
    deliveryBusinessDays != null
    && deliveryBusinessDays !== undefined
    && String(deliveryBusinessDays).trim() !== ""
  ) {
    if (!Number.isInteger(deliveryBusinessDays) || deliveryBusinessDays < 1) {
      throw new Error("Si indicas tiempo de entrega, usa un entero mayor o igual a 1.");
    }
    frozenDeliveryDays = deliveryBusinessDays;
  }
  const campoPricing = parseFieldServicePricing(
    quote.quoteType,
    fieldServiceHours,
    quote.lines.map((line) => {
      const price = prices.find((item) => item.lineId === line.id);
      return { unitPrice: price?.amount ?? line.unitPrice };
    }),
  );
  await prisma.$transaction(async (tx) => {
    for (const price of prices) {
      const line = quote.lines.find((item) => item.id === price.lineId);
      if (!line) throw new Error("Hay un concepto que no pertenece a la cotización.");
      if (!Number.isFinite(price.amount) || price.amount < 0) throw new Error("El precio no es válido.");
      const increment = line.incrementPct;
      let unitAmount = price.amount;
      if (campoPricing && quote.quoteType === "CAMPO") {
        unitAmount = campoPricing.hours * campoPricing.unitPrice;
      }
      await tx.quoteLine.update({
        where: { id: line.id },
        data: increment != null
          ? { basePrice: unitAmount, unitPrice: finalFromBase(unitAmount, increment) }
          : { unitPrice: unitAmount, basePrice: null },
      });
    }
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, version },
      data: {
        status: "PENDIENTE_DECISION",
        creditDays: quote.creditDays,
        ...(quote.sellerUserId == null && quote.client.ownerUserId
          ? { sellerUserId: quote.client.ownerUserId }
          : {}),
        ...(frozenDeliveryDays != null ? { deliveryBusinessDays: frozenDeliveryDays } : {}),
        ...(campoPricing
          ? { fieldServiceHours: campoPricing.hours, fieldServiceUnitPrice: campoPricing.unitPrice }
          : {}),
        version: { increment: 1 },
      },
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

/** The CEO may correct the generated wording before a technical quote is priced. */
export async function updateGeneratedQuoteConcepts(
  actor: Actor,
  quoteId: string,
  version: number,
  concepts: Array<{ lineId: string; concept: string }>,
) {
  if (actor.role !== "CEO") throw new Error("Solo el CEO puede ajustar el concepto de una cotización generada.");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId, technicalCaseId: { not: null }, status: "PENDIENTE_COTIZAR" },
    include: { lines: true },
  });
  if (!quote) throw new Error("Solo se ajusta el concepto de una cotización generada que aún no tiene precio.");
  if (concepts.length !== quote.lines.length || new Set(concepts.map((item) => item.lineId)).size !== concepts.length) {
    throw new Error("La cotización tiene conceptos incompletos.");
  }
  const changes = concepts.map((item) => {
    const line = quote.lines.find((candidate) => candidate.id === item.lineId);
    const concept = item.concept.trim();
    if (!line || !concept) throw new Error("Cada concepto debe tener una descripción.");
    return { line, concept };
  });
  const changed = changes.filter(({ line, concept }) => line.concept !== concept);
  if (changed.length === 0) return;
  await prisma.$transaction(async (tx) => {
    for (const { line, concept } of changed) {
      await tx.quoteLine.update({ where: { id: line.id }, data: { concept } });
    }
    const updated = await tx.quote.updateMany({ where: { id: quote.id, version }, data: { version: { increment: 1 } } });
    if (updated.count === 0) throw new ConcurrencyError();
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "CONCEPTO",
    summary: `CEO ajustó el concepto antes de asignar precio: ${changed.map(({ line, concept }) => `${line.concept} → ${concept}`).join(" | ")}.`,
    authorUserId: actor.userId,
  });
}

/** The assigned seller may add the commercial note shown in italics below the technical concept. */
export async function updateSellerQuoteConceptComplement(
  actor: Actor,
  quoteId: string,
  version: number,
  complement: string | null,
) {
  if (actor.role !== "VENTAS") throw new Error("Solo el Vendedor puede modificar el complemento del concepto.");
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      companyId: actor.activeCompanyId,
      sellerUserId: actor.userId,
      status: { in: ["PENDIENTE_COTIZAR", "PENDIENTE_DECISION"] },
    },
  });
  if (!quote) throw new Error("Esta cotización ya no permite modificar el complemento del concepto.");
  const next = complement?.trim() || null;
  if (next && next.length > 500) throw new Error("El complemento puede tener hasta 500 caracteres.");
  if (next === quote.sellerConceptComplement) return;
  const updated = await prisma.quote.updateMany({
    where: { id: quote.id, version },
    data: { sellerConceptComplement: next, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "COMPLEMENTO_CONCEPTO",
    summary: next ? "Vendedor actualizó el complemento comercial del concepto." : "Vendedor eliminó el complemento comercial del concepto.",
    authorUserId: actor.userId,
  });
}

export function assertSellerDiscountAllowed(discountPct: number, limitPct: number | null | undefined) {
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 100) throw new Error("El descuento no es válido.");
  if (discountPct === 0) return;
  if (limitPct == null) {
    throw new Error("Tu usuario no tiene límite de descuento configurado. Pide a administración que lo asigne.");
  }
  if (discountPct > limitPct) throw new Error(`Tu límite de descuento es ${limitPct}%.`);
}

async function sellerDiscountLimit(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { discountLimitPct: true } });
  return user?.discountLimitPct ?? null;
}

export async function applyDiscount(actor: Actor, quoteId: string, version: number, discountPct: number) {
  if (actor.role !== "VENTAS") throw new Error("Solo el Vendedor puede aplicar descuentos.");
  assertSellerDiscountAllowed(discountPct, await sellerDiscountLimit(actor.userId));
  const updated = await prisma.quote.updateMany({
    where: {
      id: quoteId,
      companyId: actor.activeCompanyId,
      sellerUserId: actor.userId,
      status: "PENDIENTE_DECISION",
      version,
    },
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
  rejectionReason?: string | null,
  discountPct?: number | null,
) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId },
    include: { lines: true, client: true },
  });
  if (!quote || quote.status !== "PENDIENTE_DECISION") throw new Error("La cotización no está pendiente de decisión.");
  if (actor.role === "VENTAS" && quote.sellerUserId !== actor.userId) throw new Error(SALES_NOT_ASSIGNED_MESSAGE);
  if (quote.lines.some((line) => line.unitPrice == null)) throw new Error("Falta el precio.");
  if (!authorized && !rejectionReason) throw new Error("Indica por qué el cliente no autorizó la cotización.");
  const chosen = authorized ? quote.lines.filter((line) => quote.quoteType !== "VENTA_EQUIPO" || lineIds.includes(line.id)) : [];
  if (authorized && chosen.length === 0) throw new Error("Selecciona al menos una línea autorizada.");
  const serviceQuote = quote.quoteType === "DIAGNOSTICO" || quote.quoteType === "REPARACION";
  const equipment = quote.equipmentId
    ? await prisma.equipment.findUnique({ where: { id: quote.equipmentId } })
    : null;
  const diagnosis = quote.technicalCaseId
    ? await prisma.technicalCase.findUnique({ where: { id: quote.technicalCaseId } })
    : null;
  const received = Boolean(equipment && equipment.custody === "EN_RESGUARDO");
  const inShop = Boolean(received && diagnosis?.kind === "DIAGNOSTICO" && equipment?.holderCompanyId === diagnosis.serviceCompanyId);
  const cotosInShop = Boolean(
    authorized
    && isCotosQuote(quote)
    && received
    && equipment?.holderCompanyId
    && !quote.technicalCaseId,
  );
  const cotdxInShop = Boolean(
    authorized
    && quote.quoteType === "DIAGNOSTICO"
    && isSellerCommercialQuote(quote)
    && received
    && equipment?.holderCompanyId
    && !quote.technicalCaseId,
  );
  const needsEquipment = authorized && serviceQuote && diagnosis?.kind !== "OS" && !received && !cotosInShop && !cotdxInShop;
  const status = !authorized ? "NO_AUTORIZADA" : needsEquipment ? "AUTORIZADA_PENDIENTE_EQUIPO" : "AUTORIZADA";
  const creditDays = quote.client.creditDays;
  const saleFolio = status === "AUTORIZADA" && quote.quoteType === "VENTA_EQUIPO" ? await allocateFolio(quote.companyId, "VTA") : null;
  let nextDiscountPct = quote.discountPct;
  if (actor.role === "VENTAS" && discountPct != null && Number.isFinite(discountPct)) {
    assertSellerDiscountAllowed(discountPct, await sellerDiscountLimit(actor.userId));
    nextDiscountPct = discountPct;
  }
  const repairSlaOnAuthorize = authorized && quote.deliveryBusinessDays != null && quote.deliveryBusinessDays >= 1
    && (quote.quoteType === "REPARACION" || (quote.quoteType === "DIAGNOSTICO" && quote.technicalCaseId))
    ? (() => {
        const clientAuthorizedAt = new Date();
        const slaStartedAt = normalizeSlaStartFromAuthorization(clientAuthorizedAt);
        const slaDueAt = addBusinessDays(slaStartedAt, quote.deliveryBusinessDays!);
        return { clientAuthorizedAt, slaStartedAt, slaDueAt };
      })()
    : null;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, version },
      data: {
        status,
        creditDays,
        discountPct: nextDiscountPct,
        ...(repairSlaOnAuthorize ?? {}),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    if (repairSlaOnAuthorize?.slaDueAt && diagnosis?.kind === "OS") {
      await tx.technicalCase.update({
        where: { id: diagnosis.id },
        data: { slaDueAt: repairSlaOnAuthorize.slaDueAt },
      });
    }
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
    summary: authorized
      ? `Decisión: ${status}. El crédito queda congelado.`
      : `El cliente no autorizó. Motivo: ${rejectionReason}. Se conserva el historial.`,
    authorUserId: actor.userId,
  });
  if (!authorized && diagnosis?.kind === "DIAGNOSTICO") {
    const { archivePartPresolicitudesForDiagnosis } = await import("./part-presolicitud");
    await archivePartPresolicitudesForDiagnosis(diagnosis.id);
  }
  if (authorized && inShop && diagnosis && quote.quoteType === "REPARACION") {
    await openRepairOrder(diagnosis.id, actor.userId);
  }
  if (
    authorized
    && inShop
    && diagnosis
    && quote.quoteType === "DIAGNOSTICO"
    && quote.technicalCaseId
    && quote.deliveryBusinessDays != null
    && quote.deliveryBusinessDays >= 1
  ) {
    await openRepairOrder(diagnosis.id, actor.userId);
  }
  if (authorized && quote.quoteType === "CAMPO") {
    const fresh = await prisma.quote.findUnique({
      where: { id: quote.id },
      include: { lines: true },
    });
    if (fresh) {
      await createFieldServiceCaseFromQuote(
        {
          id: fresh.id,
          companyId: fresh.companyId,
          clientId: fresh.clientId,
          sellerUserId: fresh.sellerUserId,
          lines: fresh.lines.map((line) => ({ ...line, authorized: chosen.some((c) => c.id === line.id) })),
          fieldServiceHours: fresh.fieldServiceHours,
          fieldServiceUnitPrice: fresh.fieldServiceUnitPrice,
        },
        actor.userId,
      );
    }
  }
  const activeQuote = authorized
    ? await prisma.quote.findUnique({ where: { id: quote.id }, include: { lines: true } })
    : null;
  if (
    authorized
    && needsEquipment
    && equipment
    && activeQuote
    && isSellerCommercialQuote(activeQuote)
    && (activeQuote.quoteType === "DIAGNOSTICO" || isCotosQuote(activeQuote))
  ) {
    await ensureCommercialAttentionBeforeWarehouse(actor, activeQuote, equipment);
  }
  if (authorized && cotosInShop && equipment && activeQuote) {
    await openCotosRepairFromQuote(actor, activeQuote, equipment.id);
  }
  if (authorized && cotdxInShop && equipment && activeQuote) {
    await openCotdxFromQuote(actor, activeQuote, equipment.id);
  }
}

/** Atención ABIERTA tras autorizar COTDX/COTOS comercial con equipo aún fuera de resguardo (ingreso en almacén). */
async function ensureCommercialAttentionBeforeWarehouse(
  actor: Actor,
  quote: {
    id: string;
    clientId: string;
    quoteType: string;
    folio: string;
    technicalCaseId: string | null;
    sellerUserId: string | null;
    priorityName: string | null;
    priorityPrice: number | null;
    priorityIncrementPct: number | null;
    priorityTargetMinDays: number | null;
    priorityTargetMaxDays: number | null;
    prioritySlaMaxDays: number | null;
    lines: Array<{ authorized: boolean; concept: string; unitPrice: number | null; basePrice: number | null; incrementPct: number | null }>;
  },
  equipment: { id: string; kind: string; originCompanyId: string },
) {
  const existing = await prisma.attention.findFirst({ where: { originQuoteId: quote.id } });
  if (existing) return;
  const stored = await prisma.quote.findUnique({
    where: { id: quote.id },
    select: {
      id: true,
      quoteType: true,
      folio: true,
      equipmentId: true,
      technicalCaseId: true,
      reservedServiceNumber: true,
    },
  });
  const reservedServiceNumber = stored
    ? await ensureQuoteWorkshopSrvReservation(stored, actor.activeCompanyId)
    : null;
  const attentionType = commercialAttentionTypeForQuote(quote);
  const fromQuote = frozenPriorityFromQuote(quote);
  if (!fromQuote && quote.quoteType === "DIAGNOSTICO") {
    throw new Error("La cotización COTDX no tiene prioridad congelada.");
  }
  if (!fromQuote && isCotosQuote(quote)) {
    await ensureReparacionTallerPriorities(actor.activeCompanyId);
  }
  const priority = fromQuote ?? {
    name: "Normal",
    price: null as number | null,
    incrementPct: 0,
    targetMinDays: 5,
    targetMaxDays: 10,
    slaMaxDays: 10,
  };
  const service = equipment.kind === "MOT"
    ? await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } })
    : await prisma.company.findUnique({ where: { id: actor.activeCompanyId } });
  if (!service) throw new Error("No está definida la empresa que ejecuta el servicio.");
  const concept = quote.lines.find((line) => line.authorized)?.concept ?? quote.lines[0]?.concept ?? "Servicio autorizado";
  const quotePriceLine = quote.lines.find((line) => line.authorized && line.unitPrice != null)
    ?? quote.lines.find((line) => line.unitPrice != null);
  const attention = await prisma.attention.create({
    data: {
      equipmentId: equipment.id,
      originCompanyId: equipment.originCompanyId,
      serviceCompanyId: service.id,
      adminClientId: quote.clientId,
      attentionType,
      priorityName: priority.name,
      priorityPrice: quotePriceLine?.basePrice ?? priority.price,
      priorityIncrementPct: quotePriceLine?.incrementPct ?? priority.incrementPct,
      priorityTargetMin: priority.targetMinDays,
      priorityTargetMax: priority.targetMaxDays,
      prioritySlaMaxDays: priority.slaMaxDays,
      reportedFault: concept,
      sellerUserId: quote.sellerUserId,
      originQuoteId: quote.id,
      status: "ABIERTA",
      slaStartedAt: null,
      ...(reservedServiceNumber != null ? { serviceNumber: reservedServiceNumber } : {}),
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "ATENCION",
    summary: `Atención ${ATTENTION_LABEL[attentionType]} abierta para ingreso en almacén tras autorización.`,
    authorUserId: actor.userId,
  });
}

export async function relateQuoteEquipment(actor: Actor, quoteId: string, version: number, equipmentId: string, priorityId: string) {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId },
    include: { lines: true },
  });
  if (!quote || quote.status !== "AUTORIZADA_PENDIENTE_EQUIPO") throw new Error("Esta cotización no está esperando el equipo.");
  if (quote.technicalCaseId) throw new Error("Esta cotización ya tiene operación técnica.");
  if (quote.quoteType !== "DIAGNOSTICO" && quote.quoteType !== "REPARACION") throw new Error("Este tipo no abre operación al ingresar el equipo.");
  const equipment = await prisma.equipment.findFirst({ where: { id: equipmentId, originCompanyId: actor.activeCompanyId, clientId: quote.clientId } });
  if (!equipment) throw new Error("El equipo no es de este cliente en esta empresa.");
  const attentionType = commercialAttentionTypeForQuote(quote);
  const fromQuote = frozenPriorityFromQuote(quote);
  const priority = fromQuote
    ?? await freezePriorityFromCatalog(actor.activeCompanyId, attentionType, priorityId);
  if (!fromQuote && !priorityId) throw new Error("Selecciona una prioridad vigente de este servicio.");
  const service = equipment.kind === "MOT"
    ? await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } })
    : await prisma.company.findUnique({ where: { id: actor.activeCompanyId } });
  if (!service) throw new Error("No está definida la empresa que ejecuta el servicio.");
  const inShop =
    equipment.kind !== "EQUI"
    && equipment.custody === "EN_RESGUARDO"
    && equipment.holderCompanyId === service.id;
  const concept = quote.lines.find((line) => line.authorized)?.concept ?? quote.lines[0]?.concept ?? "Servicio autorizado";
  if (equipment.kind === "EQUI" && equipment.custody === "EN_RESGUARDO") {
    await prisma.equipment.update({
      where: { id: equipment.id },
      data: { custody: "SIN_CUSTODIA", holderCompanyId: null, version: { increment: 1 } },
    });
  }
  const quotePriceLine = quote.lines.find((line) => line.authorized && line.unitPrice != null) ?? quote.lines.find((line) => line.unitPrice != null);
  const reservedServiceNumber = await ensureQuoteWorkshopSrvReservation(quote, actor.activeCompanyId);
  let attention = await prisma.attention.findFirst({ where: { originQuoteId: quote.id } });
  if (!attention) {
    attention = await prisma.attention.create({
      data: {
        equipmentId: equipment.id,
        originCompanyId: equipment.originCompanyId,
        serviceCompanyId: service.id,
        adminClientId: quote.clientId,
        attentionType,
        priorityName: priority.name,
        priorityPrice: quotePriceLine?.basePrice ?? priority.price,
        priorityIncrementPct: quotePriceLine?.incrementPct ?? priority.incrementPct,
        priorityTargetMin: priority.targetMinDays,
        priorityTargetMax: priority.targetMaxDays,
        prioritySlaMaxDays: priority.slaMaxDays,
        reportedFault: concept,
        sellerUserId: quote.sellerUserId,
        originQuoteId: quote.id,
        status: inShop ? "EN_PROCESO" : "ABIERTA",
        slaStartedAt: inShop ? new Date() : null,
        ...(reservedServiceNumber != null ? { serviceNumber: reservedServiceNumber } : {}),
      },
    });
  } else if (inShop && attention.slaStartedAt == null) {
    attention = await prisma.attention.update({
      where: { id: attention.id },
      data: { status: "EN_PROCESO", slaStartedAt: new Date() },
    });
  }
  const updated = await prisma.quote.updateMany({
    where: { id: quote.id, version },
    data: { equipmentId: equipment.id, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "EQUIPO",
    summary: inShop
      ? `${equipment.folio} quedó relacionado y ya está en resguardo. Arranca la operación.`
      : `${equipment.folio} quedó relacionado. La operación arranca con la entrada física.`,
    authorUserId: actor.userId,
  });
  if (!inShop) return;
  const { openCase } = await import("./technical");
  const created = await openCase(attention.id, attention.slaStartedAt ?? new Date());
  if (!created) return;
  await linkCommercialQuoteToTechnicalCase(
    quote.id,
    equipment.id,
    created.id,
    isCotosQuote(quote) ? quote : undefined,
  );
}

async function applyCotosDeliverySlaToCase(
  quote: { deliveryBusinessDays: number | null; clientAuthorizedAt: Date | null },
  caseId: string,
) {
  if (quote.deliveryBusinessDays == null || quote.deliveryBusinessDays < 1) return;
  const clientAuthorizedAt = quote.clientAuthorizedAt ?? new Date();
  const slaStartedAt = normalizeSlaStartFromAuthorization(clientAuthorizedAt);
  const slaDueAt = addBusinessDays(slaStartedAt, quote.deliveryBusinessDays);
  await prisma.technicalCase.update({ where: { id: caseId }, data: { slaDueAt, quotePending: false } });
}

async function linkCommercialQuoteToTechnicalCase(
  quoteId: string,
  equipmentId: string,
  caseId: string,
  cotosSla?: { deliveryBusinessDays: number | null; clientAuthorizedAt: Date | null },
) {
  if (cotosSla) await applyCotosDeliverySlaToCase(cotosSla, caseId);
  await prisma.quote.update({
    where: { id: quoteId },
    data: { technicalCaseId: caseId, equipmentId, status: "AUTORIZADA", version: { increment: 1 } },
  });
}

async function openCotdxFromQuote(
  actor: Actor,
  quote: {
    id: string;
    companyId: string;
    clientId: string;
    sellerUserId: string | null;
    lines: Array<{ authorized: boolean; concept: string; unitPrice: number | null; basePrice: number | null; incrementPct: number | null }>;
    priorityName: string | null;
    priorityPrice: number | null;
    priorityIncrementPct: number | null;
    priorityTargetMinDays: number | null;
    priorityTargetMaxDays: number | null;
    prioritySlaMaxDays: number | null;
  },
  equipmentId: string,
) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) return;
  const service = equipment.kind === "MOT"
    ? await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } })
    : await prisma.company.findUnique({ where: { id: actor.activeCompanyId } });
  if (!service || equipment.holderCompanyId !== service.id) return;
  const existing = await prisma.attention.findFirst({
    where: { originQuoteId: quote.id },
    include: { technicalCases: true },
  });
  if (existing) {
    const dxCase = existing.technicalCases.find((row) => row.kind === "DIAGNOSTICO");
    if (dxCase) {
      await linkCommercialQuoteToTechnicalCase(quote.id, equipment.id, dxCase.id);
      return;
    }
    const slaStartedAt = existing.slaStartedAt ?? new Date();
    if (!existing.slaStartedAt) {
      await prisma.attention.update({
        where: { id: existing.id },
        data: { status: "EN_PROCESO", slaStartedAt },
      });
    }
    const { openCase } = await import("./technical");
    const created = await openCase(existing.id, slaStartedAt);
    if (!created) return;
    await linkCommercialQuoteToTechnicalCase(quote.id, equipment.id, created.id);
    return;
  }
  const fromQuote = frozenPriorityFromQuote(quote);
  if (!fromQuote) throw new Error("La cotización COTDX no tiene prioridad congelada.");
  const concept = quote.lines.find((line) => line.authorized)?.concept ?? quote.lines[0]?.concept ?? "Diagnóstico autorizado";
  const quotePriceLine = quote.lines.find((line) => line.authorized && line.unitPrice != null) ?? quote.lines.find((line) => line.unitPrice != null);
  const stored = await prisma.quote.findUnique({
    where: { id: quote.id },
    select: {
      id: true,
      quoteType: true,
      folio: true,
      equipmentId: true,
      technicalCaseId: true,
      reservedServiceNumber: true,
    },
  });
  const reservedServiceNumber = stored
    ? await ensureQuoteWorkshopSrvReservation(stored, actor.activeCompanyId)
    : null;
  const attention = await prisma.attention.create({
    data: {
      equipmentId: equipment.id,
      originCompanyId: equipment.originCompanyId,
      serviceCompanyId: service.id,
      adminClientId: quote.clientId,
      attentionType: "DIAGNOSTICO",
      priorityName: fromQuote.name,
      priorityPrice: quotePriceLine?.basePrice ?? fromQuote.price,
      priorityIncrementPct: quotePriceLine?.incrementPct ?? fromQuote.incrementPct,
      priorityTargetMin: fromQuote.targetMinDays,
      priorityTargetMax: fromQuote.targetMaxDays,
      prioritySlaMaxDays: fromQuote.slaMaxDays,
      reportedFault: concept,
      sellerUserId: quote.sellerUserId,
      originQuoteId: quote.id,
      status: "EN_PROCESO",
      slaStartedAt: new Date(),
      ...(reservedServiceNumber != null ? { serviceNumber: reservedServiceNumber } : {}),
    },
  });
  const { openCase } = await import("./technical");
  const created = await openCase(attention.id, attention.slaStartedAt ?? new Date());
  if (!created) return;
  await linkCommercialQuoteToTechnicalCase(quote.id, equipment.id, created.id);
}

async function openCotosRepairFromQuote(
  actor: Actor,
  quote: {
    id: string;
    companyId: string;
    clientId: string;
    sellerUserId: string | null;
    lines: Array<{ authorized: boolean; concept: string; unitPrice: number | null; basePrice: number | null; incrementPct: number | null }>;
    deliveryBusinessDays: number | null;
    clientAuthorizedAt: Date | null;
    priorityName: string | null;
    priorityPrice: number | null;
    priorityIncrementPct: number | null;
    priorityTargetMinDays: number | null;
    priorityTargetMaxDays: number | null;
    prioritySlaMaxDays: number | null;
  },
  equipmentId: string,
) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) return;
  const service = equipment.kind === "MOT"
    ? await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } })
    : await prisma.company.findUnique({ where: { id: actor.activeCompanyId } });
  if (!service || equipment.holderCompanyId !== service.id) return;
  const existing = await prisma.attention.findFirst({
    where: { originQuoteId: quote.id },
    include: { technicalCases: true },
  });
  if (existing) {
    const osCase = existing.technicalCases.find((row) => row.kind === "OS");
    if (osCase) {
      await linkCommercialQuoteToTechnicalCase(quote.id, equipment.id, osCase.id, quote);
      return;
    }
    const slaStartedAt = existing.slaStartedAt ?? new Date();
    if (!existing.slaStartedAt) {
      await prisma.attention.update({
        where: { id: existing.id },
        data: { status: "EN_PROCESO", slaStartedAt },
      });
    }
    const { openCase } = await import("./technical");
    const created = await openCase(existing.id, slaStartedAt);
    if (!created) return;
    await linkCommercialQuoteToTechnicalCase(quote.id, equipment.id, created.id, quote);
    return;
  }
  const fromQuote = frozenPriorityFromQuote(quote);
  if (!fromQuote) {
    await ensureReparacionTallerPriorities(actor.activeCompanyId);
  }
  const priority = fromQuote ?? {
    name: "Normal",
    price: null as number | null,
    incrementPct: 0,
    targetMinDays: 5,
    targetMaxDays: 10,
    slaMaxDays: 10,
  };
  const concept = quote.lines.find((line) => line.authorized)?.concept ?? quote.lines[0]?.concept ?? "Reparación autorizada";
  const quotePriceLine = quote.lines.find((line) => line.authorized && line.unitPrice != null) ?? quote.lines.find((line) => line.unitPrice != null);
  const stored = await prisma.quote.findUnique({
    where: { id: quote.id },
    select: {
      id: true,
      quoteType: true,
      folio: true,
      equipmentId: true,
      technicalCaseId: true,
      reservedServiceNumber: true,
    },
  });
  const reservedServiceNumber = stored
    ? await ensureQuoteWorkshopSrvReservation(stored, actor.activeCompanyId)
    : null;
  const attention = await prisma.attention.create({
    data: {
      equipmentId: equipment.id,
      originCompanyId: equipment.originCompanyId,
      serviceCompanyId: service.id,
      adminClientId: quote.clientId,
      attentionType: "REPARACION_TALLER",
      priorityName: priority.name,
      priorityPrice: quotePriceLine?.basePrice ?? priority.price,
      priorityIncrementPct: quotePriceLine?.incrementPct ?? priority.incrementPct,
      priorityTargetMin: priority.targetMinDays,
      priorityTargetMax: priority.targetMaxDays,
      prioritySlaMaxDays: priority.slaMaxDays,
      reportedFault: concept,
      sellerUserId: quote.sellerUserId,
      originQuoteId: quote.id,
      status: "EN_PROCESO",
      slaStartedAt: new Date(),
      ...(reservedServiceNumber != null ? { serviceNumber: reservedServiceNumber } : {}),
    },
  });
  const { openCase } = await import("./technical");
  const created = await openCase(attention.id, attention.slaStartedAt ?? new Date());
  if (!created) return;
  await linkCommercialQuoteToTechnicalCase(quote.id, equipment.id, created.id, quote);
}

export async function openWaitingRepairs(equipmentId: string, authorUserId: string) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment || equipment.custody !== "EN_RESGUARDO" || !equipment.holderCompanyId) return;
  const quotes = await prisma.quote.findMany({
    where: {
      equipmentId,
      status: "AUTORIZADA_PENDIENTE_EQUIPO",
      quoteType: "REPARACION",
      technicalCaseId: { not: null },
    },
  });
  for (const quote of quotes) {
    const diagnosis = await prisma.technicalCase.findUnique({ where: { id: quote.technicalCaseId! } });
    if (!diagnosis || diagnosis.kind !== "DIAGNOSTICO" || equipment.holderCompanyId !== diagnosis.serviceCompanyId) continue;
    const opened = await openRepairOrder(diagnosis.id, authorUserId);
    if (opened) {
      await prisma.quote.update({ where: { id: quote.id }, data: { status: "AUTORIZADA", version: { increment: 1 } } });
    }
  }
  const linked = await prisma.quote.findMany({
    where: { equipmentId, status: "AUTORIZADA_PENDIENTE_EQUIPO", technicalCaseId: null },
  });
  for (const quote of linked) {
    const attention = await prisma.attention.findFirst({
      where: { originQuoteId: quote.id },
      include: { technicalCases: true },
    });
    const opened = attention ? pickCommercialCaseForAttention(quote, attention.technicalCases) : null;
    if (!opened) continue;
    await linkCommercialQuoteToTechnicalCase(
      quote.id,
      equipmentId,
      opened.id,
      isCotosQuote(quote) ? quote : undefined,
    );
  }
}

async function openRepairOrder(diagnosisCaseId: string, authorUserId: string) {
  const diagnosis = await prisma.technicalCase.findUnique({
    where: { id: diagnosisCaseId },
    include: { attention: true },
  });
  if (!diagnosis) return null;
  const repairQuote = await prisma.quote.findFirst({
    where: {
      technicalCaseId: diagnosis.id,
      quoteType: "REPARACION",
      status: { in: ["AUTORIZADA", "AUTORIZADA_PENDIENTE_EQUIPO"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { slaDueAt: true },
  });
  const diagnosisQuote = await prisma.quote.findFirst({
    where: {
      technicalCaseId: diagnosis.id,
      quoteType: "DIAGNOSTICO",
      status: { in: ["AUTORIZADA", "AUTORIZADA_PENDIENTE_EQUIPO"] },
      deliveryBusinessDays: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: { slaDueAt: true },
  });
  const slaDueAt = repairOrderSlaDueAt(repairQuote, diagnosisQuote, diagnosis);
  let osCase = await prisma.$transaction((tx) =>
    ensureOsStubForDiagnosis(diagnosis.attention, diagnosis, tx),
  );
  if (!osCase) {
    osCase = await prisma.technicalCase.findFirst({ where: { spawnedFromId: diagnosis.id, kind: "OS" } });
  }
  if (osCase) {
    if (slaDueAt && osCase.slaDueAt == null) {
      osCase = await prisma.technicalCase.update({
        where: { id: osCase.id },
        data: { slaDueAt, quotePending: false },
      });
    }
    const { promotePartPresolicitudesToRepairOrder } = await import("./part-presolicitud");
    await promotePartPresolicitudesToRepairOrder(diagnosis.id, osCase.id, authorUserId);
    return osCase;
  }
  const created = await prisma.$transaction(async (tx) => {
    let n = diagnosis.attention.serviceNumber ?? serviceCycleNumberFromFolio(diagnosis.folio);
    if (n == null) {
      n = await ensureAttentionServiceNumber(diagnosis.attentionId, diagnosis.serviceCompanyId, tx);
    } else if (diagnosis.attention.serviceNumber !== n) {
      await tx.attention.update({
        where: { id: diagnosis.attentionId },
        data: { serviceNumber: n },
      });
    }
    const folio = formatServiceFolio("OS", n);
    return tx.technicalCase.create({
      data: {
        folio,
        attentionId: diagnosis.attentionId,
        equipmentId: diagnosis.equipmentId,
        serviceCompanyId: diagnosis.serviceCompanyId,
        kind: "OS",
        status: "EN_ESPERA",
        spawnedFromId: diagnosis.id,
        slaDueAt,
        quotePending: false,
      },
    });
  });
  await recordHistory({
    companyId: diagnosis.serviceCompanyId,
    entityType: "OPERACION",
    entityId: created.id,
    action: "ALTA",
    summary: `${created.folio} abierta porque la cotización fue autorizada y el equipo ya está en resguardo.`,
    authorUserId,
  });
  const { promotePartPresolicitudesToRepairOrder } = await import("./part-presolicitud");
  await promotePartPresolicitudesToRepairOrder(diagnosis.id, created.id, authorUserId);
  return created;
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
