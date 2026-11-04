import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export class FolioError extends Error {}

export type ServiceFolioSeries = "DX" | "OS" | "COT" | "FAC" | "REM";

type Tx = Prisma.TransactionClient;

export function formatServiceFolio(series: ServiceFolioSeries, n: number): string {
  return `${series}-${n}`;
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
  if (tx) return nextSequenceNumber(companyId, "SRV", tx);
  return prisma.$transaction(async (inner) => allocateServiceNumber(companyId, inner));
}

export async function ensureAttentionServiceNumber(
  attentionId: string,
  companyId: string,
  tx: Tx,
): Promise<number> {
  const attention = await tx.attention.findUnique({
    where: { id: attentionId },
    select: { serviceNumber: true },
  });
  if (!attention) throw new FolioError("Atención no encontrada");
  if (attention.serviceNumber != null) return attention.serviceNumber;
  const serviceNumber = await allocateServiceNumber(companyId, tx);
  await tx.attention.update({ where: { id: attentionId }, data: { serviceNumber } });
  return serviceNumber;
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
