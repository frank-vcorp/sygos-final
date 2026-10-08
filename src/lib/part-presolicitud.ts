import { prisma } from "./db";
import { recordHistory } from "./history";

type Actor = {
  userId: string;
  role: string;
  activeCompanyId: string;
};

export const PRESOLICITUD_LABEL: Record<string, string> = {
  ACTIVA: "Activa",
  PROMOVIDA: "Promovida a orden",
  ARCHIVADA: "Archivada",
};

const EDITABLE_DIAGNOSIS = ["EN_DIAGNOSTICO", "DEVUELTO"] as const;

export function diagnosisPresolicitudEditable(status: string) {
  return (EDITABLE_DIAGNOSIS as readonly string[]).includes(status);
}

async function loadDiagnosisCase(caseId: string) {
  const row = await prisma.technicalCase.findUnique({ where: { id: caseId } });
  if (!row || row.kind !== "DIAGNOSTICO") throw new Error("Las presolicitudes solo aplican a un diagnóstico.");
  return row;
}

function assertTechnicianPresolicitud(actor: Actor, row: { assigneeUserId: string | null; serviceCompanyId: string }) {
  if (actor.role !== "TECNICO") throw new Error("Solo el técnico asignado registra presolicitudes.");
  if (row.assigneeUserId !== actor.userId) throw new Error("Solo el técnico asignado registra presolicitudes.");
  if (actor.activeCompanyId !== row.serviceCompanyId) throw new Error("SYSTRON consulta esta operación en solo lectura. El estado lo cambia quien ejecuta el servicio.");
}

function parseQty(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("La cantidad debe ser un entero mayor a cero.");
}

export async function createPartPresolicitud(
  actor: Actor,
  caseId: string,
  input: { partNumber: string; description: string; link: string | null; quantity: number },
) {
  const row = await loadDiagnosisCase(caseId);
  assertTechnicianPresolicitud(actor, row);
  if (!diagnosisPresolicitudEditable(row.status)) throw new Error("El diagnóstico ya está terminado. Las presolicitudes ya no se editan.");
  parseQty(input.quantity);
  await prisma.partPresolicitud.create({
    data: {
      diagnosisCaseId: row.id,
      companyId: row.serviceCompanyId,
      partNumber: input.partNumber.trim(),
      description: input.description.trim(),
      link: input.link?.trim() || null,
      qtyRequested: input.quantity,
      status: "ACTIVA",
    },
  });
}

export async function updatePartPresolicitud(
  actor: Actor,
  presolicitudId: string,
  input: { partNumber: string; description: string; link: string | null; quantity: number },
) {
  const presol = await prisma.partPresolicitud.findUnique({ where: { id: presolicitudId }, include: { diagnosisCase: true } });
  if (!presol || presol.companyId !== actor.activeCompanyId) throw new Error("No se encontró la presolicitud.");
  assertTechnicianPresolicitud(actor, presol.diagnosisCase);
  if (presol.status !== "ACTIVA") throw new Error("Solo se editan presolicitudes activas.");
  if (!diagnosisPresolicitudEditable(presol.diagnosisCase.status)) throw new Error("El diagnóstico ya está terminado.");
  parseQty(input.quantity);
  await prisma.partPresolicitud.update({
    where: { id: presol.id },
    data: {
      partNumber: input.partNumber.trim(),
      description: input.description.trim(),
      link: input.link?.trim() || null,
      qtyRequested: input.quantity,
    },
  });
}

export async function deletePartPresolicitud(actor: Actor, presolicitudId: string) {
  const presol = await prisma.partPresolicitud.findUnique({ where: { id: presolicitudId }, include: { diagnosisCase: true } });
  if (!presol || presol.companyId !== actor.activeCompanyId) throw new Error("No se encontró la presolicitud.");
  assertTechnicianPresolicitud(actor, presol.diagnosisCase);
  if (presol.status !== "ACTIVA") throw new Error("Solo se eliminan presolicitudes activas.");
  if (!diagnosisPresolicitudEditable(presol.diagnosisCase.status)) throw new Error("El diagnóstico ya está terminado.");
  await prisma.partPresolicitud.delete({ where: { id: presol.id } });
}

export async function archivePartPresolicitudesForDiagnosis(diagnosisCaseId: string) {
  await prisma.partPresolicitud.updateMany({
    where: { diagnosisCaseId, status: "ACTIVA" },
    data: { status: "ARCHIVADA" },
  });
}

export async function promotePartPresolicitudesToRepairOrder(
  diagnosisCaseId: string,
  repairCaseId: string,
  authorUserId: string,
) {
  const pending = await prisma.partPresolicitud.findMany({
    where: { diagnosisCaseId, status: "ACTIVA" },
    orderBy: { createdAt: "asc" },
  });
  if (pending.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const need of pending) {
      const request = await tx.partRequest.create({
        data: {
          caseId: repairCaseId,
          companyId: need.companyId,
          partNumber: need.partNumber,
          description: need.description,
          link: need.link,
          qtyRequested: need.qtyRequested,
          status: "SOLICITADA",
        },
      });
      await tx.partPresolicitud.update({
        where: { id: need.id },
        data: { status: "PROMOVIDA", partRequestId: request.id },
      });
    }
    const repair = await tx.technicalCase.findUnique({ where: { id: repairCaseId } });
    if (repair && ["EN_ESPERA", "EN_REPARACION"].includes(repair.status)) {
      await tx.technicalCase.update({
        where: { id: repairCaseId },
        data: { status: "EN_ESPERA_REFACCIONES", version: { increment: 1 } },
      });
    }
  });

  await recordHistory({
    companyId: pending[0]!.companyId,
    entityType: "OPERACION",
    entityId: repairCaseId,
    action: "REFACCIONES",
    summary: `${pending.length} presolicitud(es) del diagnóstico pasaron a solicitud en esta orden.`,
    authorUserId,
  });

  return pending.length;
}
