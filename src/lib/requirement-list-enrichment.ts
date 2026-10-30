import { prisma } from "@/lib/db";
import { partRequestShortfall } from "@/lib/part-inventory";
import { equipmentDetailHref, equipmentIdentificationLabel } from "@/lib/requirement-display";

export type RequirementListContext = {
  diagLabel: string;
  diagHref: string | null;
  osLabel: string;
  osHref: string | null;
  equipmentLabel: string;
  equipmentHref: string | null;
  slaDueAt: Date | null;
};

const emptyContext = (): RequirementListContext => ({
  diagLabel: "—",
  diagHref: null,
  osLabel: "—",
  osHref: null,
  equipmentLabel: "—",
  equipmentHref: null,
  slaDueAt: null,
});

function contextFromCase(
  caseRow: {
    id: string;
    folio: string;
    kind: string;
    slaDueAt: Date | null;
    spawnedFromId: string | null;
    equipment: {
      id: string;
      kind: string;
      folio?: string | null;
      typeName?: string | null;
      brandName: string | null;
      model: string;
      serial: string | null;
    };
  },
  diagnosisById: Map<string, { id: string; folio: string }>,
): RequirementListContext {
  const equipmentLabel = equipmentIdentificationLabel(caseRow.equipment);
  const equipmentHref = equipmentDetailHref(caseRow.equipment);
  if (caseRow.kind === "DX" || caseRow.kind === "DIAGNOSTICO") {
    return {
      diagLabel: caseRow.folio,
      diagHref: `/operacion/${caseRow.id}`,
      osLabel: "—",
      osHref: null,
      equipmentLabel,
      equipmentHref,
      slaDueAt: caseRow.slaDueAt,
    };
  }
  const diagnosis = caseRow.spawnedFromId ? diagnosisById.get(caseRow.spawnedFromId) : null;
  return {
    diagLabel: diagnosis?.folio ?? "—",
    diagHref: diagnosis ? `/operacion/${diagnosis.id}` : null,
    osLabel: caseRow.folio,
    osHref: `/operacion/${caseRow.id}`,
    equipmentLabel,
    equipmentHref,
    slaDueAt: caseRow.slaDueAt,
  };
}

const CLOSED_CASES = ["VALIDADO", "TERMINADA", "SIN_REPARACION"] as const;

export async function syncPendingPartRequestRequirements(companyId: string): Promise<void> {
  const [openRequests, pendingOsRequirements] = await Promise.all([
    prisma.partRequest.findMany({
      where: {
        companyId,
        case: { status: { notIn: [...CLOSED_CASES] } },
      },
      include: {
        case: {
          select: {
            assigneeUserId: true,
            attention: { select: { createdByUserId: true } },
            equipment: { select: { createdByUserId: true } },
          },
        },
      },
    }),
    prisma.requirement.findMany({
      where: {
        companyId,
        sourceType: "OS",
        status: "PENDIENTE",
      },
      select: { id: true, sourceId: true, quantity: true },
    }),
  ]);

  const openById = new Map(openRequests.map((row) => [row.id, row]));
  const obsoleteReqIds: string[] = [];
  for (const req of pendingOsRequirements) {
    const pr = req.sourceId ? openById.get(req.sourceId) : undefined;
    if (!pr || pr.qtyIssued >= pr.qtyRequested || partRequestShortfall(pr) <= 0) {
      obsoleteReqIds.push(req.id);
    } else {
      const shortfall = partRequestShortfall(pr);
      if (req.quantity !== shortfall) {
        await prisma.requirement.update({
          where: { id: req.id },
          data: { quantity: shortfall },
        });
      }
    }
  }
  if (obsoleteReqIds.length > 0) {
    await prisma.requirement.deleteMany({
      where: { id: { in: obsoleteReqIds }, status: "PENDIENTE" },
    });
  }

  const requestsNeedingPurchase = openRequests.filter(
    (row) => row.qtyIssued < row.qtyRequested && partRequestShortfall(row) > 0,
  );
  if (requestsNeedingPurchase.length === 0) return;

  const existing = await prisma.requirement.findMany({
    where: {
      companyId,
      sourceType: "OS",
      sourceId: { in: requestsNeedingPurchase.map((row) => row.id) },
    },
    select: { sourceId: true },
  });
  const existingIds = new Set(existing.map((row) => row.sourceId));
  const missing = requestsNeedingPurchase.filter((row) => !existingIds.has(row.id));
  if (missing.length === 0) return;

  const fallbackUser = await prisma.user.findFirst({
    where: { OR: [{ companyId }, { companyId: null }], active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  for (const request of missing) {
    const shortfall = partRequestShortfall(request);
    if (shortfall <= 0) continue;
    const requesterUserId =
      request.case.assigneeUserId
      ?? request.case.attention.createdByUserId
      ?? request.case.equipment.createdByUserId
      ?? fallbackUser?.id;
    if (!requesterUserId) continue;
    await prisma.requirement.upsert({
      where: { companyId_sourceType_sourceId: { companyId, sourceType: "OS", sourceId: request.id } },
      update: {
        quantity: shortfall,
      },
      create: {
        companyId,
        partNumber: request.partNumber,
        description: request.description,
        quantity: shortfall,
        kind: "REFACCION",
        requesterUserId,
        sourceType: "OS",
        sourceId: request.id,
      },
    });
  }
}

export async function loadRequirementListContexts(
  companyId: string,
  requirements: Array<{ id: string; sourceType: string | null; sourceId: string | null }>,
): Promise<Map<string, RequirementListContext>> {
  const contexts = new Map<string, RequirementListContext>();
  for (const row of requirements) contexts.set(row.id, emptyContext());
  const osIds = requirements.filter((row) => row.sourceType === "OS" && row.sourceId).map((row) => row.sourceId as string);
  const dxIds = requirements.filter((row) => row.sourceType === "DX" && row.sourceId).map((row) => row.sourceId as string);
  if (!osIds.length && !dxIds.length) return contexts;

  const [partRequests, presolicitudes] = await Promise.all([
    osIds.length
      ? prisma.partRequest.findMany({
          where: { id: { in: osIds }, companyId },
          include: { case: { include: { equipment: true } } },
        })
      : Promise.resolve([]),
    dxIds.length
      ? prisma.partPresolicitud.findMany({
          where: { id: { in: dxIds }, companyId },
          include: {
            diagnosisCase: { include: { equipment: true } },
            partRequest: { include: { case: { include: { equipment: true } } } },
          },
        })
      : Promise.resolve([]),
  ]);

  const spawnedFromIds = [
    ...partRequests.map((request) => request.case.spawnedFromId).filter(Boolean),
    ...presolicitudes.map((presol) => presol.partRequest?.case.spawnedFromId).filter(Boolean),
  ] as string[];
  const diagnosisById = new Map<string, { id: string; folio: string }>();
  if (spawnedFromIds.length) {
    const diagnoses = await prisma.technicalCase.findMany({
      where: { id: { in: spawnedFromIds }, kind: { in: ["DIAGNOSTICO", "DX"] } },
      select: { id: true, folio: true },
    });
    for (const row of diagnoses) diagnosisById.set(row.id, row);
  }

  for (const requirement of requirements) {
    if (requirement.sourceType === "OS" && requirement.sourceId) {
      const request = partRequests.find((row) => row.id === requirement.sourceId);
      if (request) contexts.set(requirement.id, contextFromCase(request.case, diagnosisById));
    }
    if (requirement.sourceType === "DX" && requirement.sourceId) {
      const presol = presolicitudes.find((row) => row.id === requirement.sourceId);
      if (!presol) continue;
      const diagnosis = presol.diagnosisCase;
      const osCase = presol.partRequest?.case.kind === "OS" ? presol.partRequest.case : null;
      contexts.set(requirement.id, {
        diagLabel: diagnosis.folio,
        diagHref: `/operacion/${diagnosis.id}`,
        osLabel: osCase?.folio ?? "—",
        osHref: osCase ? `/operacion/${osCase.id}` : null,
        equipmentLabel: equipmentIdentificationLabel(diagnosis.equipment),
        equipmentHref: equipmentDetailHref(diagnosis.equipment),
        slaDueAt: osCase?.slaDueAt ?? diagnosis.slaDueAt,
      });
    }
  }

  return contexts;
}
