import { prisma } from "./db";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { archivePartPresolicitudesForDiagnosis } from "./part-presolicitud";

type Actor = {
  userId: string;
  role: string;
  activeCompanyId: string;
  activeCompanyCode?: string;
};

export function isNormalDiagnosisPriority(priorityName: string, priorityPrice: number | null | undefined) {
  if (priorityName === "Normal") return true;
  return priorityPrice == null || priorityPrice === 0;
}

export function isPaidDiagnosisPriority(priorityName: string, priorityPrice: number | null | undefined) {
  return !isNormalDiagnosisPriority(priorityName, priorityPrice);
}

export function dxNoRepairPickupSheetLabel(dxFolio: string) {
  return `Hoja DX sin reparación · ${dxFolio}`;
}

export function diagnosisNoRepairEligible(attentionType: string) {
  return attentionType === "DIAGNOSTICO";
}

export async function markDiagnosisNoRepair(actor: Actor, caseId: string, version: number, reason: string) {
  const row = await prisma.technicalCase.findUnique({
    where: { id: caseId },
    include: { attention: true, serviceCompany: true },
  });
  if (!row || row.kind !== "DIAGNOSTICO") throw new Error("Esta no es una operación de diagnóstico.");
  if (!diagnosisNoRepairEligible(row.attention.attentionType)) {
    throw new Error("Sin reparación solo aplica a diagnóstico normal, no a garantía.");
  }
  if (actor.activeCompanyId !== row.serviceCompanyId) {
    throw new Error("SYSTRON consulta esta operación en solo lectura. El estado lo cambia quien ejecuta el servicio.");
  }
  const canExecute =
    actor.role === "ADMINISTRADOR"
    || actor.role === "CEO"
    || actor.role === "SUPERVISOR_TECNICO"
    || (actor.role === "GERENTE_OPERATIVO_SERVOMOTORES" && row.serviceCompany.code === "SERVOMOTORES")
    || (actor.role === "TECNICO" && row.assigneeUserId === actor.userId);
  if (!canExecute) throw new Error("Solo quien ejecuta puede marcar sin reparación.");
  if (!["EN_DIAGNOSTICO", "DEVUELTO"].includes(row.status)) {
    throw new Error("Sin reparación solo aplica mientras el diagnóstico está en ejecución.");
  }
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Indica el motivo de sin reparación.");

  const updated = await prisma.technicalCase.updateMany({
    where: { id: row.id, version },
    data: {
      noRepairAt: new Date(),
      noRepairReason: trimmed,
      noRepairByUserId: actor.userId,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await archivePartPresolicitudesForDiagnosis(row.id);
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "SIN_REPARACION",
    summary: `Diagnóstico marcado sin reparación: ${trimmed}`,
    authorUserId: actor.userId,
  });
}

export async function applyDiagnosisNoRepairAfterValidation(actor: Actor, caseId: string) {
  const row = await prisma.technicalCase.findUnique({
    where: { id: caseId },
    include: {
      attention: true,
      equipment: { include: { client: true } },
      serviceCompany: true,
    },
  });
  if (!row?.noRepairAt || !diagnosisNoRepairEligible(row.attention.attentionType)) return;
  if (row.status !== "VALIDADO") return;

  if (isPaidDiagnosisPriority(row.attention.priorityName, row.attention.priorityPrice)) {
    const { requestFromDiagnosisNoRepair } = await import("./billing");
    await requestFromDiagnosisNoRepair(
      {
        userId: actor.userId,
        role: actor.role as import("./roles").Role,
        activeCompanyId: actor.activeCompanyId,
        activeCompanyCode: actor.activeCompanyCode ?? row.serviceCompany.code,
      },
      row.id,
    );
    await recordHistory({
      companyId: actor.activeCompanyId,
      entityType: "OPERACION",
      entityId: row.id,
      action: "FACTURACION",
      summary: `Solicitud de facturación por prioridad ${row.attention.priorityName} (DX sin reparación).`,
      authorUserId: actor.userId,
    });
    return;
  }

  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "RETIRO",
    summary: `Equipo liberable con ${dxNoRepairPickupSheetLabel(row.folio)} tras validación.`,
    authorUserId: actor.userId,
  });
}

export async function findValidatedNoRepairDiagnosis(input: {
  equipmentId: string;
  serviceCompanyId: string;
  attentionId?: string | null;
}) {
  const attentionFilter = input.attentionId ? { attentionId: input.attentionId } : {};
  return prisma.technicalCase.findFirst({
    where: {
      equipmentId: input.equipmentId,
      serviceCompanyId: input.serviceCompanyId,
      kind: "DIAGNOSTICO",
      status: "VALIDADO",
      noRepairAt: { not: null },
      attention: { attentionType: "DIAGNOSTICO" },
      ...attentionFilter,
    },
    orderBy: { validatedAt: "desc" },
    include: { attention: true },
  });
}
