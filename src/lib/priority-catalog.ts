import { prisma } from "./db";
import { initialPriorities } from "./priorities";

/** Catálogo DIAGNOSTICO MOT en SYSTRON (precios distintos de EQUI). */
export async function ensureMotDiagnosisPriorities(companyId: string, companyCode: string) {
  if (companyCode !== "SYSTRON") return;
  const existing = await prisma.priority.count({
    where: { companyId, attentionType: "DIAGNOSTICO", equipmentKind: "MOT" },
  });
  if (existing > 0) return;
  const motRows = initialPriorities("SYSTRON").filter(
    (row) => row.attentionType === "DIAGNOSTICO" && row.equipmentKind === "MOT",
  );
  if (motRows.length === 0) return;
  for (const row of motRows) {
    await prisma.priority.upsert({
      where: {
        companyId_attentionType_name_equipmentKind: {
          companyId,
          attentionType: row.attentionType,
          name: row.name,
          equipmentKind: row.equipmentKind,
        },
      },
      update: {},
      create: { companyId, ...row },
    });
  }
}

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
      equipmentKind: row.equipmentKind ?? "EQUI",
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
