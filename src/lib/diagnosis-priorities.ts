import { prisma } from "@/lib/db";
import { ensureMotDiagnosisPriorities } from "@/lib/priority-catalog";
import type { DiagnosisPriorityOption } from "@/lib/diagnosis-priorities-shared";

export type { DiagnosisPriorityOption } from "@/lib/diagnosis-priorities-shared";
export { filterDiagnosisPrioritiesForEquipment } from "@/lib/diagnosis-priorities-shared";

export async function loadDiagnosisPriorityOptions(
  companyId: string,
  companyCode: string | null,
): Promise<DiagnosisPriorityOption[]> {
  await ensureMotDiagnosisPriorities(companyId, companyCode ?? "");
  const rows = await prisma.priority.findMany({
    where: { companyId, attentionType: "DIAGNOSTICO", active: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    equipmentKind: row.equipmentKind === "MOT" ? "MOT" : "EQUI",
    label:
      companyCode === "SYSTRON" && row.equipmentKind === "MOT"
        ? `${row.name} · MOT`
        : row.name,
  }));
}
