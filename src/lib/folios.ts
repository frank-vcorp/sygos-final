import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export class FolioError extends Error {}

export type ServiceFolioSeries = "DX" | "OS" | "COT" | "FAC" | "REM";

type Tx = Prisma.TransactionClient;

const SERVICE_CYCLE_FOLIO = /^(DX|OS|COT|FAC|REM)-(\d+)$/;

export function formatServiceFolio(series: ServiceFolioSeries, n: number): string {
  return `${series}-${n}`;
}

export function serviceCycleNumberFromFolio(folio: string): number | null {
  const match = folio.match(SERVICE_CYCLE_FOLIO);
  if (!match) return null;
  const n = Number.parseInt(match[2]!, 10);
  return Number.isFinite(n) ? n : null;
}

/** Alinea SRV con folios legacy y serviceNumber ya usados en la empresa de servicio. */
async function bootstrapServiceSequence(serviceCompanyId: string, tx: Tx): Promise<void> {
  let maxUsed = 0;

  const cases = await tx.technicalCase.findMany({
    where: { serviceCompanyId },
    select: { folio: true },
  });
  for (const row of cases) {
    const n = serviceCycleNumberFromFolio(row.folio);
    if (n != null && n > maxUsed) maxUsed = n;
  }

  const attentionMax = await tx.attention.aggregate({
    where: { serviceCompanyId, serviceNumber: { not: null } },
    _max: { serviceNumber: true },
  });
  if (attentionMax._max.serviceNumber != null && attentionMax._max.serviceNumber > maxUsed) {
    maxUsed = attentionMax._max.serviceNumber;
  }

  const originMax = await tx.attention.aggregate({
    where: {
      originCompanyId: serviceCompanyId,
      serviceCompanyId: { not: serviceCompanyId },
      originServiceNumber: { not: null },
    },
    _max: { originServiceNumber: true },
  });
  if (originMax._max.originServiceNumber != null && originMax._max.originServiceNumber > maxUsed) {
    maxUsed = originMax._max.originServiceNumber;
  }

  const reservedMax = await tx.quote.aggregate({
    where: { companyId: serviceCompanyId, reservedServiceNumber: { not: null } },
    _max: { reservedServiceNumber: true },
  });
  if (reservedMax._max.reservedServiceNumber != null && reservedMax._max.reservedServiceNumber > maxUsed) {
    maxUsed = reservedMax._max.reservedServiceNumber;
  }

  for (const folio of (
    await tx.quote.findMany({ where: { companyId: serviceCompanyId }, select: { folio: true } })
  ).map((row) => row.folio)) {
    const n = serviceCycleNumberFromFolio(folio);
    if (n != null && n > maxUsed) maxUsed = n;
  }
  for (const folio of (
    await tx.billingDocument.findMany({ where: { companyId: serviceCompanyId }, select: { folio: true } })
  ).map((row) => row.folio)) {
    const n = serviceCycleNumberFromFolio(folio);
    if (n != null && n > maxUsed) maxUsed = n;
  }

  const minNext = maxUsed + 1;
  if (minNext <= 1) return;

  const existing = await tx.folioSequence.findUnique({
    where: { companyId_series: { companyId: serviceCompanyId, series: "SRV" } },
  });
  if (!existing) {
    await tx.folioSequence.create({
      data: { companyId: serviceCompanyId, series: "SRV", nextNumber: minNext },
    });
    return;
  }
  if (existing.nextNumber < minNext) {
    await tx.folioSequence.update({
      where: { id: existing.id },
      data: { nextNumber: minNext },
    });
  }
}

async function nextSequenceNumber(scope: string, series: string, tx: Tx): Promise<number> {
  const existing = await tx.folioSequence.findUnique({
    where: { companyId_series: { companyId: scope, series } },
  });
  const row =
    existing ??
    (await tx.folioSequence.create({
      data: { companyId: scope, series, nextNumber: 1 },
    }));
  const number = row.nextNumber;
  await tx.folioSequence.update({
    where: { id: row.id },
    data: { nextNumber: number + 1 },
  });
  return number;
}

/** Reserva el siguiente entero de la serie interna SRV (una vez por servicio/atención). */
export async function allocateServiceNumber(companyId: string, tx?: Tx): Promise<number> {
  if (!companyId) throw new FolioError("La serie SRV requiere empresa");
  if (tx) {
    await bootstrapServiceSequence(companyId, tx);
    return nextSequenceNumber(companyId, "SRV", tx);
  }
  return prisma.$transaction(async (inner) => allocateServiceNumber(companyId, inner));
}

export type CompanyFolioAttention = {
  originCompanyId: string;
  serviceCompanyId: string;
  serviceNumber: number | null;
  originServiceNumber: number | null;
};

/** Folio que muestra una empresa. El caso guarda el de quien ejecuta; el origen usa su propio SRV. */
export function displayCompanyCaseFolio(
  storedFolio: string,
  attention: CompanyFolioAttention,
  viewingCompanyId: string,
): string {
  const series = storedFolio.match(/^(DX|OS|COT|FAC|REM)-/)?.[1] as ServiceFolioSeries | undefined;
  if (
    series
    && viewingCompanyId === attention.originCompanyId
    && attention.originCompanyId !== attention.serviceCompanyId
    && attention.originServiceNumber != null
  ) {
    return formatServiceFolio(series, attention.originServiceNumber);
  }
  return storedFolio;
}

export async function ensureAttentionServiceNumber(
  attentionId: string,
  companyId: string,
  tx: Tx,
): Promise<number> {
  const attention = await tx.attention.findUnique({
    where: { id: attentionId },
    select: {
      serviceNumber: true,
      originServiceNumber: true,
      serviceCompanyId: true,
      originCompanyId: true,
      originQuoteId: true,
    },
  });
  if (!attention) throw new FolioError("Atención no encontrada");

  const forOrigin = companyId === attention.originCompanyId && attention.originCompanyId !== attention.serviceCompanyId;
  if (forOrigin) {
    if (attention.originServiceNumber != null) return attention.originServiceNumber;
    const originServiceNumber = await allocateServiceNumber(attention.originCompanyId, tx);
    const claimed = await tx.attention.updateMany({
      where: { id: attentionId, originServiceNumber: null },
      data: { originServiceNumber },
    });
    if (claimed.count === 1) return originServiceNumber;
    const again = await tx.attention.findUnique({
      where: { id: attentionId },
      select: { originServiceNumber: true },
    });
    if (again?.originServiceNumber == null) throw new FolioError("No se pudo apartar el folio de la empresa de origen");
    return again.originServiceNumber;
  }

  if (attention.serviceNumber != null) return attention.serviceNumber;
  if (attention.originQuoteId) {
    const reserved = (
      await tx.quote.findUnique({
        where: { id: attention.originQuoteId },
        select: { reservedServiceNumber: true },
      })
    )?.reservedServiceNumber;
    // La reserva comercial se aparta en la empresa que ejecuta, aunque la cotización viva en el origen.
    if (reserved != null) {
      await tx.attention.update({ where: { id: attentionId }, data: { serviceNumber: reserved } });
      return reserved;
    }
  }
  const serviceNumber = await allocateServiceNumber(attention.serviceCompanyId, tx);
  await tx.attention.update({ where: { id: attentionId }, data: { serviceNumber } });
  return serviceNumber;
}

/** Aparta el SRV de origen de atenciones cuyo taller es otra empresa. No cambia el folio del caso. */
export async function ensureOriginCompanyServiceNumber(attentionId: string): Promise<number | null> {
  return prisma.$transaction(async (tx) => {
    const attention = await tx.attention.findUnique({
      where: { id: attentionId },
      select: { originCompanyId: true, serviceCompanyId: true, originServiceNumber: true },
    });
    if (!attention || attention.originCompanyId === attention.serviceCompanyId) return null;
    if (attention.originServiceNumber != null) return attention.originServiceNumber;
    return ensureAttentionServiceNumber(attentionId, attention.originCompanyId, tx);
  });
}

/** Si el cliente ya autorizó, la OS del taller deja de ser un stub y Systron aparta su propio número. */
export async function revealAuthorizedIntercompanyOrders(): Promise<void> {
  const stubs = await prisma.technicalCase.findMany({
    where: {
      kind: "OS",
      quotePending: true,
      spawnedFromId: { not: null },
      attention: { attentionType: "DIAGNOSTICO" },
    },
    select: {
      id: true,
      spawnedFromId: true,
      attentionId: true,
      equipmentId: true,
      attention: { select: { originCompanyId: true, serviceCompanyId: true } },
    },
    take: 100,
  });
  for (const stub of stubs) {
    if (!stub.spawnedFromId || stub.attention.originCompanyId === stub.attention.serviceCompanyId) continue;
    const authorized = await prisma.quote.findFirst({
      where: {
        quoteType: { in: ["DIAGNOSTICO", "REPARACION"] },
        status: { in: ["AUTORIZADA", "AUTORIZADA_PENDIENTE_EQUIPO"] },
        OR: [
          { technicalCaseId: { in: [stub.spawnedFromId, stub.id] } },
          { equipmentId: stub.equipmentId, technicalCaseId: null },
        ],
      },
      select: { id: true },
    });
    if (!authorized) continue;
    await prisma.technicalCase.updateMany({
      where: { id: stub.id, quotePending: true },
      data: { quotePending: false },
    });
    await ensureOriginCompanyServiceNumber(stub.attentionId);
  }
}

export async function ensureOriginCompanyServiceNumbers(attentionIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = [...new Set(attentionIds)];
  if (ids.length === 0) return map;
  const rows = await prisma.attention.findMany({
    where: { id: { in: ids } },
    select: { id: true, originCompanyId: true, serviceCompanyId: true, originServiceNumber: true },
  });
  for (const row of rows) {
    if (row.originCompanyId === row.serviceCompanyId) continue;
    if (row.originServiceNumber != null) {
      map.set(row.id, row.originServiceNumber);
      continue;
    }
    const n = await ensureOriginCompanyServiceNumber(row.id);
    if (n != null) map.set(row.id, n);
  }
  return map;
}

/** Folio visible ligado al ciclo de servicio (mismo entero SRV, distinto prefijo). */
export async function serviceFolioForAttention(
  attentionId: string,
  companyId: string,
  series: ServiceFolioSeries,
  tx?: Tx,
): Promise<string> {
  const build = async (inner: Tx) => {
    const n = await ensureAttentionServiceNumber(attentionId, companyId, inner);
    return formatServiceFolio(series, n);
  };
  if (tx) return build(tx);
  return prisma.$transaction(build);
}

/**
 * Allocates the next visible folio. Sequences never reset and never reuse numbers.
 * MOT is the only global series (companyId GLOBAL). Every other series is per company.
 */
export async function allocateFolio(companyId: string, series: string): Promise<string> {
  const scope = series === "MOT" ? "GLOBAL" : companyId;
  if (!scope) throw new FolioError("La serie requiere empresa");

  return prisma.$transaction(async (tx) => {
    const number = await nextSequenceNumber(scope, series, tx);
    return `${series}-${number}`;
  });
}
