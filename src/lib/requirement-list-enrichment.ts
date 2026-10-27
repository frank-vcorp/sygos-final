import { prisma } from "@/lib/db";
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
    equipment: { id: string; kind: string; brandName: string | null; model: string; serial: string | null };
  },
  diagnosisById: Map<string, { id: string; folio: string }>,
): RequirementListContext {
  const equipmentLabel = equipmentIdentificationLabel(caseRow.equipment);
  const equipmentHref = equipmentDetailHref(caseRow.equipment);
  if (caseRow.kind === "DX") {
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
      where: { id: { in: spawnedFromIds }, kind: "DX" },
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
