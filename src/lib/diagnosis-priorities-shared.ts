import { diagnosisPriorityEquipmentKind, type PriorityEquipmentKind } from "@/lib/priorities";

export type DiagnosisPriorityOption = {
  id: string;
  name: string;
  equipmentKind: PriorityEquipmentKind;
  label: string;
};

export function filterDiagnosisPrioritiesForEquipment(
  options: DiagnosisPriorityOption[],
  companyCode: string | null,
  equipmentKind: "EQUI" | "MOT",
): DiagnosisPriorityOption[] {
  const catalogKind = diagnosisPriorityEquipmentKind(companyCode, equipmentKind);
  return options.filter((row) => row.equipmentKind === catalogKind);
}
