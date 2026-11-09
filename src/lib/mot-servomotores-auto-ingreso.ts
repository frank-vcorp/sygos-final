import { prisma } from "@/lib/db";
import { allocateFolio } from "@/lib/folios";
import { recordHistory } from "@/lib/history";
import { nextCustody, receiptReasonFromAttention, type Custody } from "@/lib/custody";
import { pickEntradaAttention } from "@/lib/almacen-entrada";
import { openPendingCases } from "@/lib/technical";

const CLOSED_CASE = ["VALIDADO", "TERMINADA", "SIN_REPARACION"] as const;

export async function resolveGerenteServomotoresAssignee(
  serviceCompanyId: string,
  preferredUserId?: string | null,
): Promise<string | null> {
  if (preferredUserId) {
    const preferred = await prisma.user.findFirst({
      where: {
        id: preferredUserId,
        active: true,
        companyId: serviceCompanyId,
        role: "GERENTE_OPERATIVO_SERVOMOTORES",
      },
      select: { id: true },
    });
    if (preferred) return preferred.id;
  }
  const gerente = await prisma.user.findFirst({
    where: { companyId: serviceCompanyId, role: "GERENTE_OPERATIVO_SERVOMOTORES", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return gerente?.id ?? null;
}

export type MotServomotoresAutoIngresoInput = {
  equipmentId: string;
  serviceCompanyId: string;
  authorUserId: string;
  preferredAssigneeUserId?: string | null;
  attentionId?: string | null;
  occurredAt?: Date;
};

/** MOT en SERVOMOTORES: ingreso físico automático a resguardo, SLA y asignación al gerente cuando aplica. */
export async function applyMotServomotoresAutoIngreso(input: MotServomotoresAutoIngresoInput): Promise<boolean> {
  const equipment = await prisma.equipment.findUnique({
    where: { id: input.equipmentId },
    include: {
      attentions: {
        select: {
          id: true,
          status: true,
          slaStartedAt: true,
          attentionType: true,
          reportedFault: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!equipment || equipment.kind !== "MOT" || equipment.custody !== "PENDIENTE_INGRESO") return false;

  const service = await prisma.company.findUnique({ where: { id: input.serviceCompanyId } });
  if (!service || service.code !== "SERVOMOTORES") return false;

  const occurredAt = input.occurredAt ?? new Date();
  const attention =
    (input.attentionId
      ? equipment.attentions.find((row) => row.id === input.attentionId)
      : null)
    ?? pickEntradaAttention(equipment.attentions);
  const reason =
    (attention ? receiptReasonFromAttention(attention.attentionType) : null) ?? "Diagnóstico";
  const custody: Custody = nextCustody("MOT", equipment.custody, "INGRESO");
  const folio = await allocateFolio(service.id, "ING");

  await prisma.$transaction(async (tx) => {
    await tx.equipment.update({
      where: { id: equipment.id },
      data: {
        custody,
        holderCompanyId: service.id,
        version: { increment: 1 },
      },
    });
    await tx.custodyMovement.create({
      data: {
        folio,
        equipmentId: equipment.id,
        companyId: service.id,
        attentionId: attention?.id ?? null,
        kind: "INGRESO",
        reason,
        authorUserId: input.authorUserId,
        occurredAt,
      },
    });
    await tx.attention.updateMany({
      where: { equipmentId: equipment.id, slaStartedAt: null },
      data: { status: "EN_PROCESO", slaStartedAt: occurredAt },
    });
  });

  await openPendingCases(equipment.id, occurredAt);
  const { openWaitingRepairs } = await import("@/lib/quotes");
  await openWaitingRepairs(equipment.id, input.authorUserId);

  const assigneeUserId = await resolveGerenteServomotoresAssignee(
    service.id,
    input.preferredAssigneeUserId,
  );
  if (assigneeUserId) {
    await prisma.technicalCase.updateMany({
      where: {
        equipmentId: equipment.id,
        serviceCompanyId: service.id,
        assigneeUserId: null,
        status: { notIn: [...CLOSED_CASE] },
      },
      data: { assigneeUserId },
    });
  }

  await recordHistory({
    companyId: service.id,
    entityType: "EQUIPO",
    entityId: equipment.id,
    action: "CUSTODIA",
    summary: `${folio} ingreso automático en taller Servomotores. Custodia: ${custody}.`,
    authorUserId: input.authorUserId,
  });
  if (attention?.id) {
    await recordHistory({
      companyId: service.id,
      entityType: "ATENCION",
      entityId: attention.id,
      action: "ENTRADA_FISICA",
      summary: `${folio} ingreso automático. El motor quedó en resguardo e inició la atención.`,
      authorUserId: input.authorUserId,
    });
  }

  return true;
}

export async function autoIngresoMotIfServomotores(
  equipmentId: string,
  serviceCompanyId: string,
  authorUserId: string,
  options?: { preferredAssigneeUserId?: string | null; attentionId?: string | null },
): Promise<boolean> {
  return applyMotServomotoresAutoIngreso({
    equipmentId,
    serviceCompanyId,
    authorUserId,
    preferredAssigneeUserId: options?.preferredAssigneeUserId,
    attentionId: options?.attentionId ?? null,
  });
}

/** Tras abrir casos técnicos en SM, asigna al gerente cuando el actor es gerente o hay gerente activo. */