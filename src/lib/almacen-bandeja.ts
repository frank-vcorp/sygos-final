import {
  equipmentDetailHref,
  formatEquipmentBandejaLabel,
  physicalStatusFromCustody,
  type StackedStatus,
} from "@/lib/servicios-bandeja";

type TechnicalCaseSlice = {
  id: string;
  folio: string;
  kind: string;
  spawnedFromId: string | null;
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
  clientName: string;
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
    client: { name: string };
    attentions: AttentionSlice[];
  },
  options: { vistaQuery?: string; hideClient?: boolean },
): AlmacenBandejaRow {
  const attention =
    equipment.attentions.find((row) => row.status === "ABIERTA" || row.status === "EN_PROCESO")
    ?? equipment.attentions[0]
    ?? null;
  const cases = attention?.technicalCases ?? [];
  const os = cases.find((c) => c.kind === "OS") ?? null;
  const diagnosis =
    cases.find((c) => c.kind === "DIAGNOSTICO")
    ?? (os?.spawnedFromId ? cases.find((c) => c.id === os.spawnedFromId) : null)
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
    clientName: options.hideClient ? "SYSTRON · intercompañía" : equipment.client.name,
    physical: physicalStatusFromCustody(equipment.custody),
    sellerName: null,
  };
}
