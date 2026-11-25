import { prisma } from "./db";
import { recordHistory } from "./history";
import { technicalServiceConcept } from "./quote-concept";
import { can } from "./permissions";
import { isReparacionExpressAttentionType } from "./priorities";
import type { Role } from "./roles";

type PriceActor = {
  userId: string;
  role: Role;
  activeCompanyId: string;
  activeCompanyCode: string | null;
};

const caseInclude = {
  attention: true,
  equipment: true,
} as const;

/** Días hábiles obligatorios salvo reparación Express. */
export function serviceDeliveryDaysRequired(kind: string, attentionType: string) {
  return !(kind === "OS" && isReparacionExpressAttentionType(attentionType));
}

/**
 * El DX/OS queda pendiente de precio del CEO. No crea cotización.
 * Una OS nacida de diagnóstico apunta al DX: el precio es del servicio, no de las dos piezas.
 */
export async function markServiceAwaitingCeoPrice(caseId: string) {
  const row = await prisma.technicalCase.findUnique({
    where: { id: caseId },
    include: caseInclude,
  });
  if (!row) throw new Error("No se encontró la operación técnica.");

  let target = row;
  if (row.kind === "OS" && row.spawnedFromId && row.attention.attentionType === "DIAGNOSTICO") {
    const dx = await prisma.technicalCase.findFirst({
      where: { id: row.spawnedFromId, kind: "DIAGNOSTICO" },
      include: caseInclude,
    });
    if (dx) target = dx;
  }

  const recoverValidatedDiagnosis =
    target.status === "VALIDADO" && target.kind === "DIAGNOSTICO" && target.attention.attentionType === "DIAGNOSTICO";
  if (!target.quotePending && !recoverValidatedDiagnosis) {
    throw new Error("Esta operación no está pendiente de cotizar.");
  }
  if (!target.quotePending) {
    await prisma.technicalCase.update({ where: { id: target.id }, data: { quotePending: true } });
    target.quotePending = true;
  }

  const companyId = target.equipment.originCompanyId;
  const existing = await prisma.serviceCeoPrice.findUnique({
    where: { companyId_technicalCaseId: { companyId, technicalCaseId: target.id } },
  });
  if (existing) {
    if (target.ceoPricePending) {
      await prisma.technicalCase.update({ where: { id: target.id }, data: { ceoPricePending: false } });
    }
    return existing;
  }
  if (!target.ceoPricePending) {
    await prisma.technicalCase.update({ where: { id: target.id }, data: { ceoPricePending: true } });
  }
  return null;
}

export async function listServicesPendingCeoPrice(companyId: string, take = 20) {
  return prisma.technicalCase.findMany({
    where: {
      ceoPricePending: true,
      equipment: { originCompanyId: companyId },
      serviceCeoPrices: { none: { companyId } },
    },
    include: { equipment: { include: { client: true } } },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

function parseDeliveryDays(raw: number | null | undefined, required: boolean) {
  if (raw == null || (typeof raw === "number" && Number.isNaN(raw))) {
    if (required) throw new Error("Indica el tiempo de entrega en días hábiles (entero mayor o igual a 1).");
    return null;
  }
  if (!Number.isInteger(raw) || raw < 1) {
    throw new Error(required
      ? "Indica el tiempo de entrega en días hábiles (entero mayor o igual a 1)."
      : "Si indicas tiempo de entrega, usa un entero mayor o igual a 1.");
  }
  return raw;
}

/** Guarda el precio del CEO en el servicio. No abre cotización comercial. */
export async function assignServiceCeoPrice(
  actor: PriceActor,
  caseId: string,
  input: { amount: number; concept?: string | null; deliveryBusinessDays?: number | null },
) {
  if (!can(actor.role, "quote.price", actor.activeCompanyCode)) {
    throw new Error("No tienes permiso para asignar precio.");
  }
  const row = await prisma.technicalCase.findUnique({
    where: { id: caseId },
    include: caseInclude,
  });
  if (!row) throw new Error("No se encontró la operación técnica.");
  if (row.equipment.originCompanyId !== actor.activeCompanyId) {
    throw new Error("El precio se asigna en la empresa del cliente.");
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("El precio no es válido.");

  const blocked = await prisma.quoteLine.findFirst({
    where: {
      sourceTechnicalCaseId: row.id,
      quote: {
        companyId: actor.activeCompanyId,
        quoteType: "SERVICIOS_EXISTENTES",
        status: { in: ["AUTORIZADA", "AUTORIZADA_PENDIENTE_EQUIPO"] },
      },
    },
    select: { id: true },
  });
  if (blocked) throw new Error("Este servicio ya está en una cotización autorizada.");

  const existing = await prisma.serviceCeoPrice.findUnique({
    where: { companyId_technicalCaseId: { companyId: actor.activeCompanyId, technicalCaseId: row.id } },
  });
  if (!row.ceoPricePending && !existing) {
    throw new Error("Este servicio no está pendiente de precio.");
  }

  const deliveryBusinessDays = parseDeliveryDays(
    input.deliveryBusinessDays,
    serviceDeliveryDaysRequired(row.kind, row.attention.attentionType),
  );
  const concept = (input.concept ?? "").trim() || technicalServiceConcept(row.equipment);

  const price = await prisma.serviceCeoPrice.upsert({
    where: { companyId_technicalCaseId: { companyId: actor.activeCompanyId, technicalCaseId: row.id } },
    create: {
      companyId: actor.activeCompanyId,
      technicalCaseId: row.id,
      clientId: row.equipment.clientId,
      amount: input.amount,
      concept,
      deliveryBusinessDays,
      pricedByUserId: actor.userId,
    },
    update: {
      clientId: row.equipment.clientId,
      amount: input.amount,
      concept,
      deliveryBusinessDays,
      pricedByUserId: actor.userId,
      pricedAt: new Date(),
    },
  });
  await prisma.technicalCase.update({
    where: { id: row.id },
    data: { ceoPricePending: false },
  });

  const openLine = await prisma.quoteLine.findFirst({
    where: {
      sourceTechnicalCaseId: row.id,
      quote: {
        companyId: actor.activeCompanyId,
        quoteType: "SERVICIOS_EXISTENTES",
        status: "PENDIENTE_DECISION",
      },
    },
  });
  if (openLine) {
    await prisma.quoteLine.update({
      where: { id: openLine.id },
      data: { unitPrice: input.amount, concept: lineConcept(row.folio, concept) },
    });
  }

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "PRECIO",
    summary: existing
      ? `${row.folio} quedó con precio corregido. No se creó cotización.`
      : `${row.folio} quedó con precio. No se creó cotización.`,
    authorUserId: actor.userId,
  });
  return price;
}

export function lineConcept(folio: string, concept: string) {
  const body = concept.trim();
  return body.startsWith(folio) ? body : `${folio}\n${body}`;
}
