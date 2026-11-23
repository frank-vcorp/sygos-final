export type TechnicalLogRow = {
  id: string;
  caseId: string;
  body: string;
  authorUserId: string;
  createdAt: Date;
};

export type TechnicalCaseLogMeta = {
  id: string;
  folio: string;
  kind: string;
  spawnedFromId?: string | null;
};

export function isDiagnosisCaseKind(kind: string) {
  return kind === "DIAGNOSTICO" || kind === "DX";
}

export function technicalCaseKindLabel(kind: string) {
  if (kind === "OS") return "Orden de servicio";
  if (isDiagnosisCaseKind(kind)) return "Diagnóstico";
  return kind;
}

/** Casos cuya bitácora se fusiona con la vista actual (misma atención, cadena DX ↔ OS). */
export function technicalCaseIdsForMergedBitacora(
  current: Pick<TechnicalCaseLogMeta, "id" | "kind" | "spawnedFromId">,
  siblings: Array<Pick<TechnicalCaseLogMeta, "id" | "kind" | "spawnedFromId">>,
): string[] {
  const ids = new Set<string>([current.id]);
  if (current.kind === "OS" && current.spawnedFromId) {
    ids.add(current.spawnedFromId);
  }
  if (isDiagnosisCaseKind(current.kind)) {
    for (const sibling of siblings) {
      if (sibling.kind === "OS" && sibling.spawnedFromId === current.id) {
        ids.add(sibling.id);
      }
    }
  }
  return [...ids];
}

export type MergedTechnicalLogEntry = TechnicalLogRow & {
  caseFolio: string;
  caseKind: string;
  caseKindLabel: string;
  fromCurrentCase: boolean;
};

export function mergeTechnicalLogs(
  currentCaseId: string,
  cases: TechnicalCaseLogMeta[],
  logs: TechnicalLogRow[],
): MergedTechnicalLogEntry[] {
  const metaById = new Map(cases.map((item) => [item.id, item]));
  return logs
    .map((log) => {
      const meta = metaById.get(log.caseId);
      if (!meta) return null;
      return {
        ...log,
        caseFolio: meta.folio,
        caseKind: meta.kind,
        caseKindLabel: technicalCaseKindLabel(meta.kind),
        fromCurrentCase: log.caseId === currentCaseId,
      };
    })
    .filter((item): item is MergedTechnicalLogEntry => item !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
}