import { prisma } from "./db";
import { allocateFolio } from "./folios";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { money } from "./money";
import { can } from "./permissions";
import type { Role } from "./roles";
import { SALES_NOT_ASSIGNED_MESSAGE } from "./sales-assignment";
import { addBusinessDays, normalizeSlaStartFromAuthorization } from "./sla";
import { lineConcept } from "./service-ceo-price";
import { openRepairOrder } from "./quotes";

type Actor = {
  userId: string;
  role: Role;
  activeCompanyId: string;
  activeCompanyCode: string | null;
};

export const SERVICES_QUOTE_TYPE = "SERVICIOS_EXISTENTES";
export const SERVICES_QUOTE_SERIES = "COTSV";

/** Cotización que todavía puede ganar o perder partidas, o que ya cerró el servicio. */
export const SERVICE_QUOTE_BLOCKING_STATUSES = ["PENDIENTE_DECISION", "AUTORIZADA", "AUTORIZADA_PENDIENTE_EQUIPO"] as const;

const OPEN_QUOTE_STATUS = "PENDIENTE_DECISION";

export type PricedServiceOption = {
  technicalCaseId: string;
  folio: string;
  clientId: string;
  clientName: string;
  concept: string;
  amount: number;
  amountLabel: string;
  equipmentLabel: string;
  openQuote: { id: string; folio: string } | null;
  onAuthorizedQuote: boolean;
};

export async function listPricedServices(companyId: string, sellerUserId?: string | null): Promise<PricedServiceOption[]> {
  const prices = await prisma.serviceCeoPrice.findMany({
    where: {
      companyId,
      ...(sellerUserId ? { client: { ownerUserId: sellerUserId, isSystem: false } } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
      technicalCase: {
        select: {
          id: true,
          folio: true,
          equipment: { select: { folio: true, model: true, brandName: true, serial: true } },
        },
      },
    },
    orderBy: { pricedAt: "desc" },
  });
  if (prices.length === 0) return [];
  const links = await prisma.quoteLine.findMany({
    where: {
      sourceTechnicalCaseId: { in: prices.map((row) => row.technicalCaseId) },
      quote: { companyId, quoteType: SERVICES_QUOTE_TYPE, status: { in: [...SERVICE_QUOTE_BLOCKING_STATUSES] } },
    },
    select: {
      sourceTechnicalCaseId: true,
      quote: { select: { id: true, folio: true, status: true } },
    },
  });
  return prices.map((price) => {
    const related = links.filter((link) => link.sourceTechnicalCaseId === price.technicalCaseId);
    const open = related.find((link) => link.quote.status === OPEN_QUOTE_STATUS);
    const authorized = related.find((link) => link.quote.status !== OPEN_QUOTE_STATUS);
    const equipment = price.technicalCase.equipment;
    return {
      technicalCaseId: price.technicalCaseId,
      folio: price.technicalCase.folio,
      clientId: price.clientId,
      clientName: price.client.name,
      concept: price.concept,
      amount: price.amount,
      amountLabel: money(price.amount),
      equipmentLabel: [equipment.folio, equipment.brandName, equipment.model, equipment.serial].filter(Boolean).join(" · "),
      openQuote: open ? { id: open.quote.id, folio: open.quote.folio } : null,
      onAuthorizedQuote: Boolean(authorized),
    };
  });
}

async function loadPricedRows(companyId: string, clientId: string, technicalCaseIds: string[]) {
  const unique = [...new Set(technicalCaseIds)];
  if (unique.length === 0) throw new Error("Selecciona al menos un servicio con precio.");
  const prices = await prisma.serviceCeoPrice.findMany({
    where: { companyId, technicalCaseId: { in: unique } },
    include: { technicalCase: { select: { id: true, folio: true } } },
  });
  if (prices.length !== unique.length) throw new Error("Ese servicio todavía no tiene precio de CEO.");
  if (prices.some((row) => row.clientId !== clientId)) {
    throw new Error("Todos los servicios deben ser del mismo cliente.");
  }
  return prices;
}

async function assertServicesAvailable(companyId: string, technicalCaseIds: string[], ignoreQuoteId?: string) {
  const taken = await prisma.quoteLine.findMany({
    where: {
      sourceTechnicalCaseId: { in: technicalCaseIds },
      quote: {
        companyId,
        quoteType: SERVICES_QUOTE_TYPE,
        status: { in: [...SERVICE_QUOTE_BLOCKING_STATUSES] },
        ...(ignoreQuoteId ? { id: { not: ignoreQuoteId } } : {}),
      },
    },
    select: { quote: { select: { folio: true, status: true } } },
  });
  if (taken.length === 0) return;
  const open = taken.find((row) => row.quote.status === OPEN_QUOTE_STATUS);
  if (open) throw new Error(`Ese servicio ya está en la cotización abierta ${open.quote.folio}.`);
  throw new Error("Ese servicio ya está en una cotización autorizada.");
}

export async function createServicesExistingQuote(
  actor: Actor,
  input: {
    clientId: string;
    technicalCaseIds: string[];
    reference: string | null;
    contactIds: string[];
    warrantyMonths: number;
    paymentCondition: string;
    creditDays: number | null;
  },
) {
  if (!can(actor.role, "quote.create", actor.activeCompanyCode)) {
    throw new Error("No tienes permiso para crear cotizaciones.");
  }
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, companyId: actor.activeCompanyId, active: true, isSystem: false },
  });
  if (!client) throw new Error("Selecciona un cliente activo de esta empresa.");
  if (actor.role === "VENTAS" && client.ownerUserId !== actor.userId) throw new Error(SALES_NOT_ASSIGNED_MESSAGE);
  if (input.contactIds.length === 0) throw new Error("Selecciona al menos un contacto.");
  const contacts = await prisma.contact.count({
    where: { id: { in: input.contactIds }, clientId: client.id, active: true },
  });
  if (contacts !== input.contactIds.length) throw new Error("Algún contacto no pertenece al cliente.");

  const sellerUserId =
    actor.role === "VENTAS"
    || actor.role === "GERENTE_OPERATIVO_SERVOMOTORES"
    || actor.role === "AUXILIAR_OPERATIVO_SERVOMOTORES"
      ? actor.userId
      : client.ownerUserId;
  if (!sellerUserId) {
    throw new Error("El cliente no tiene vendedor asignado. Asigna un responsable comercial en la ficha del cliente antes de crear la cotización.");
  }

  const prices = await loadPricedRows(actor.activeCompanyId, client.id, input.technicalCaseIds);
  await assertServicesAvailable(actor.activeCompanyId, prices.map((row) => row.technicalCaseId));

  const folio = await allocateFolio(actor.activeCompanyId, SERVICES_QUOTE_SERIES);
  const quote = await prisma.quote.create({
    data: {
      folio,
      companyId: actor.activeCompanyId,
      clientId: client.id,
      quoteType: SERVICES_QUOTE_TYPE,
      status: OPEN_QUOTE_STATUS,
      reference: input.reference,
      warrantyMonths: input.warrantyMonths,
      paymentCondition: input.paymentCondition,
      ...(input.creditDays != null ? { creditDays: input.creditDays } : {}),
      sellerUserId,
      lines: {
        create: prices.map((price) => ({
          concept: lineConcept(price.technicalCase.folio, price.concept),
          quantity: 1,
          unitPrice: price.amount,
          sourceTechnicalCaseId: price.technicalCaseId,
        })),
      },
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "ALTA",
    summary: `${folio} armada con ${prices.length} servicio(s) que ya tenían precio. Sigue sin autorización del cliente.`,
    authorUserId: actor.userId,
  });
  return quote;
}

/** Agrega o quita servicios mientras la cotización es la única editable. */
export async function syncServicesExistingQuoteLines(
  actor: Actor,
  quoteId: string,
  version: number,
  technicalCaseIds: string[],
) {
  if (!can(actor.role, "quote.follow", actor.activeCompanyCode)) {
    throw new Error("No tienes permiso para editar esta cotización.");
  }
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: actor.activeCompanyId },
  });
  if (!quote || quote.quoteType !== SERVICES_QUOTE_TYPE) throw new Error("Esta cotización no agrupa servicios existentes.");
  if (quote.status !== OPEN_QUOTE_STATUS) throw new Error("La cotización autorizada ya no se edita.");
  if (actor.role === "VENTAS" && quote.sellerUserId !== actor.userId) throw new Error(SALES_NOT_ASSIGNED_MESSAGE);

  const prices = await loadPricedRows(actor.activeCompanyId, quote.clientId, technicalCaseIds);
  await assertServicesAvailable(actor.activeCompanyId, prices.map((row) => row.technicalCaseId), quote.id);

  await prisma.$transaction(async (tx) => {
    await tx.quoteLine.deleteMany({ where: { quoteId: quote.id } });
    await tx.quoteLine.createMany({
      data: prices.map((price) => ({
        quoteId: quote.id,
        concept: lineConcept(price.technicalCase.folio, price.concept),
        quantity: 1,
        unitPrice: price.amount,
        sourceTechnicalCaseId: price.technicalCaseId,
      })),
    });
    const updated = await tx.quote.updateMany({
      where: { id: quote.id, version },
      data: { version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "COTIZACION",
    entityId: quote.id,
    action: "PARTIDAS",
    summary: `${quote.folio} quedó con ${prices.length} servicio(s).`,
    authorUserId: actor.userId,
  });
}

/** Al autorizar, abre la reparación de los DX que ya están en taller. No solicita factura. */
export async function releasePricedServicesAfterAuthorization(quoteId: string, authorUserId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lines: true },
  });
  if (!quote || quote.quoteType !== SERVICES_QUOTE_TYPE || quote.status !== "AUTORIZADA") return;
  for (const line of quote.lines) {
    if (!line.authorized || !line.sourceTechnicalCaseId) continue;
    const row = await prisma.technicalCase.findUnique({
      where: { id: line.sourceTechnicalCaseId },
      include: { equipment: true },
    });
    if (!row || row.kind !== "DIAGNOSTICO") continue;
    const inShop = row.equipment.custody === "EN_RESGUARDO" && row.equipment.holderCompanyId === row.serviceCompanyId;
    if (!inShop) continue;
    const price = await prisma.serviceCeoPrice.findUnique({
      where: { companyId_technicalCaseId: { companyId: quote.companyId, technicalCaseId: row.id } },
    });
    const opened = await openRepairOrder(row.id, authorUserId);
    if (opened && price?.deliveryBusinessDays && price.deliveryBusinessDays >= 1) {
      const start = normalizeSlaStartFromAuthorization(quote.clientAuthorizedAt ?? new Date());
      await prisma.technicalCase.update({
        where: { id: opened.id },
        data: { slaDueAt: addBusinessDays(start, price.deliveryBusinessDays), quotePending: false },
      });
    }
  }
}
