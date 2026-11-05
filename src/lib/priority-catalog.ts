import { prisma } from "./db";

/** Clona catálogo REPARACION → REPARACION_TALLER si aún no existe (COTOS). */
export async function ensureReparacionTallerPriorities(companyId: string) {
  const existing = await prisma.priority.count({ where: { companyId, attentionType: "REPARACION_TALLER" } });
  if (existing > 0) return;
  const source = await prisma.priority.findMany({ where: { companyId, attentionType: "REPARACION" } });
  if (source.length === 0) return;
  await prisma.priority.createMany({
    data: source.map((row) => ({
      companyId,
      attentionType: "REPARACION_TALLER",
      name: row.name,
      price: row.price,
      incrementPct: row.incrementPct,
      targetMinDays: row.targetMinDays,
      targetMaxDays: row.targetMaxDays,
      slaMaxDays: row.slaMaxDays,
      sortOrder: row.sortOrder,
      active: row.active,
    })),
  });
}
