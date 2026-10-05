import { prisma } from "./db";

export class FolioError extends Error {}

/**
 * Allocates the next visible folio. Sequences never reset and never reuse numbers.
 * MOT is the only global series (companyId GLOBAL). Every other series is per company.
 */
export async function allocateFolio(companyId: string, series: string): Promise<string> {
  const scope = series === "MOT" ? "GLOBAL" : companyId;
  if (!scope) throw new FolioError("La serie requiere empresa");

  return prisma.$transaction(async (tx) => {
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
    return `${series}-${number}`;
  });
}
