import {
  equipmentDetailHref,
  formatEquipmentBandejaLabel,
  physicalStatusFromCustody,
  type StackedStatus,
} from "@/lib/servicios-bandeja";
import { isHiddenReservedOsStubInDiagnosisCycle } from "@/lib/servicios-supervisor";

type TechnicalCaseSlice = {
  id: string;
  folio: string;
  kind: string;
  spawnedFromId: string | null;
  quotePending: boolean;
};

type AttentionSlice = {
  id: string;
  status: string;
  slaStartedAt: Date | null;
  attentionType: string;
  sellerUserId: string | null;
  technicalCases: TechnicalCaseSlice[];
};

export type AlmacenBandejaRow = {
  equipmentId: string;
  equipmentHref: string;
  equipmentLabel: string;
  diagnosisFolio: string | null;
  diagnosisHref: string | null;
  osFolio: string | null;
  osHref: string | null;
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  physical: StackedStatus;
  sellerName: string | null;
};

export function mapEquipmentToAlmacenRow(
  equipment: {
    id: string;
    kind: string;
    folio: string;
    typeName: string | null;
    brandName: string | null;
    model: string;
    custody: string;
    client: { id: string; name: string; isSystem: boolean };
    attentions: AttentionSlice[];
  },
  options: { vistaQuery?: string; hideClient?: boolean },
): AlmacenBandejaRow {
  const attention =
    equipment.attentions.find((row) => row.status === "ABIERTA" || row.status === "EN_PROCESO")
    ?? equipment.attentions[0]
    ?? null;
  const cases = attention?.technicalCases ?? [];
  const siblingPick = cases.map((c) => ({ id: c.id, kind: c.kind }));
  const osRaw = cases.find((c) => c.kind === "OS") ?? null;
  const os =
    osRaw
    && !isHiddenReservedOsStubInDiagnosisCycle(
      { ...osRaw, attention: { attentionType: attention?.attentionType ?? "" } },
      siblingPick,
    )
      ? osRaw
      : null;
  const diagnosis =
    cases.find((c) => c.kind === "DIAGNOSTICO")
    ?? (osRaw?.spawnedFromId ? cases.find((c) => c.id === osRaw.spawnedFromId) : null)
    ?? null;

  const diagnosisFolio = diagnosis?.folio ?? null;
  const diagnosisHref = diagnosis ? `/operacion/${diagnosis.id}` : null;
  const osFolio = os?.folio ?? null;
  const osHref = os ? `/operacion/${os.id}` : null;

  const q = options.vistaQuery ?? "";
  const baseHref = equipmentDetailHref(equipment.kind, equipment.id);

  return {
    equipmentId: equipment.id,
    equipmentHref: `${baseHref}${q}`,
    equipmentLabel: formatEquipmentBandejaLabel(equipment),
    diagnosisFolio,
    diagnosisHref,
    osFolio,
    osHref,
    clientId: equipment.client.id,
    clientName: equipment.client.name,
    clientIsSystem: options.hideClient ? true : equipment.client.isSystem,
    physical: physicalStatusFromCustody(equipment.custody),
    sellerName: null,
  };
}
