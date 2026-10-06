export type ProductionItem = {
  id: string;
  equipmentId: string;
  kind: "DIAGNOSTICO" | "OS";
  attentionType: string;
  status: string;
  external: boolean;
  finishedByUserId: string | null;
  finishedByRole: string | null;
  validated: boolean;
  value: number;
  originalCaseId: string | null;
};

export type ProductionCredit = {
  userId: string;
  jobs: number;
  diagnoses: number;
  repairs: number;
  withoutRepair: number;
  warranties: number;
  value: number;
  effectiveness: number | null;
};

export function productionCredit(items: ProductionItem[]): ProductionCredit[] {
  const byUser = new Map<string, ProductionCredit & { repairIds: Set<string>; warrantyOrigins: Set<string> }>();
  const ensure = (userId: string) => {
    const current = byUser.get(userId);
    if (current) return current;
    const created = { userId, jobs: 0, diagnoses: 0, repairs: 0, withoutRepair: 0, warranties: 0, value: 0, effectiveness: null, repairIds: new Set<string>(), warrantyOrigins: new Set<string>() };
    byUser.set(userId, created);
    return created;
  };
  for (const item of items) {
    if (!item.validated || !item.finishedByUserId) continue;
    if (item.finishedByRole === "GERENTE_OPERATIVO_SYSTRON") continue;
    const row = ensure(item.finishedByUserId);
    const warranty = item.attentionType === "DIAGNOSTICO_GARANTIA" || item.kind === "OS" && item.attentionType === "REPARACION_GARANTIA";
    row.jobs += 1;
    if (warranty) row.warranties += 1;
    else if (item.kind === "DIAGNOSTICO") row.diagnoses += 1;
    else if (item.kind === "OS") row.repairs += 1;
    if (item.status === "SIN_REPARACION") row.withoutRepair += 1;
    if (!warranty && !item.external) row.value += item.value;
    if (item.kind === "OS" && !warranty) row.repairIds.add(item.id);
    if (warranty && item.originalCaseId) row.warrantyOrigins.add(item.originalCaseId);
  }
  return [...byUser.values()].map((row) => {
    const returned = [...row.warrantyOrigins].filter((id) => row.repairIds.has(id)).length;
    return {
      userId: row.userId,
      jobs: row.jobs,
      diagnoses: row.diagnoses,
      repairs: row.repairs,
      withoutRepair: row.withoutRepair,
      warranties: row.warranties,
      value: Math.round(row.value * 100) / 100,
      effectiveness: row.repairs === 0 ? null : Math.round((1 - returned / row.repairs) * 100) / 100,
    };
  });
}

export function averageTicket(value: number, valuedJobs: number) {
  if (valuedJobs <= 0) return 0;
  return Math.round((value / valuedJobs) * 100) / 100;
}
