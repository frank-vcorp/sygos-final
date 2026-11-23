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

/** Clona catálogo DIAGNOSTICO → MANTENIMIENTO_PREVENTIVO si aún no existe (COTMP). */
export async function ensureMantenimientoPreventivoPriorities(companyId: string, companyCode: string) {
  await ensureMotDiagnosisPriorities(companyId, companyCode);
  const existing = await prisma.priority.count({ where: { companyId, attentionType: "MANTENIMIENTO_PREVENTIVO" } });
  if (existing > 0) return;
  const source = await prisma.priority.findMany({ where: { companyId, attentionType: "DIAGNOSTICO" } });
  const seeds =
    source.length > 0
      ? source
      : initialPriorities(companyCode === "SERVOMOTORES" ? "SERVOMOTORES" : "SYSTRON").filter(
          (row) => row.attentionType === "MANTENIMIENTO_PREVENTIVO",
        );
  if (seeds.length === 0) return;
  if (source.length > 0) {
    await prisma.priority.createMany({
      data: source.map((row) => ({
        companyId,
        attentionType: "MANTENIMIENTO_PREVENTIVO",
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
    return;
  }
  for (const row of seeds) {
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
