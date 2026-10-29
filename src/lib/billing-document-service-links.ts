import { prisma } from "@/lib/db";

export type TechnicalCaseLinkSlice = {
  id: string;
  folio: string;
  kind: string;
  spawnedFromId: string | null;
};

export type BillingDocumentServiceLinks = {
  diagnosisFolio: string | null;
  diagnosisHref: string | null;
  osFolio: string | null;
  osHref: string | null;
};

const EMPTY_LINKS: BillingDocumentServiceLinks = {
  diagnosisFolio: null,
  diagnosisHref: null,
  osFolio: null,
  osHref: null,
};

export function resolveServiceLinksFromAttentionCases(
  cases: TechnicalCaseLinkSlice[],
): BillingDocumentServiceLinks {
  const os = cases.find((c) => c.kind === "OS") ?? null;
  const diagnosis =
    cases.find((c) => c.kind === "DIAGNOSTICO")
    ?? (os?.spawnedFromId ? cases.find((c) => c.id === os.spawnedFromId) : null)
    ?? null;

  const diagnosisFolio = diagnosis?.folio ?? null;
  const diagnosisHref = diagnosis && !os ? `/operacion/${diagnosis.id}` : null;
  const osFolio = os?.folio ?? null;
  const osHref = os ? `/operacion/${os.id}` : null;

  return { diagnosisFolio, diagnosisHref, osFolio, osHref };
}

export function pickBillingDocumentTechnicalCaseId(doc: {
  technicalCaseId: string | null;
  quote?: { technicalCaseId: string | null } | null;
}): string | null {
  return doc.technicalCaseId ?? doc.quote?.technicalCaseId ?? null;
}

export function formatBillingDocumentServiceLinksDetail(links: BillingDocumentServiceLinks): string | null {
  const parts: string[] = [];
  if (links.diagnosisFolio) parts.push(`DX ${links.diagnosisFolio}`);
  if (links.osFolio) parts.push(`OS ${links.osFolio}`);
  return parts.length ? parts.join(" · ") : null;
}

export async function batchLoadBillingDocumentServiceLinks(
  caseIds: Iterable<string | null | undefined>,
): Promise<Map<string, BillingDocumentServiceLinks>> {
  const ids = [...new Set([...caseIds].filter((id): id is string => Boolean(id)))];
  const result = new Map<string, BillingDocumentServiceLinks>();
  if (ids.length === 0) return result;

  const seedCases = await prisma.technicalCase.findMany({
    where: { id: { in: ids } },
    select: { id: true, folio: true, kind: true, spawnedFromId: true, attentionId: true },
  });

  const attentionIds = [...new Set(seedCases.map((c) => c.attentionId))];
  const allCases = attentionIds.length
    ? await prisma.technicalCase.findMany({
        where: { attentionId: { in: attentionIds } },
        select: { id: true, folio: true, kind: true, spawnedFromId: true, attentionId: true },
      })
    : [];

  const casesByAttention = new Map<string, TechnicalCaseLinkSlice[]>();
  for (const c of allCases) {
    const list = casesByAttention.get(c.attentionId) ?? [];
    list.push(c);
    casesByAttention.set(c.attentionId, list);
  }

  for (const seed of seedCases) {
    const cases = casesByAttention.get(seed.attentionId) ?? [seed];
    result.set(seed.id, resolveServiceLinksFromAttentionCases(cases));
  }

  for (const id of ids) {
    if (!result.has(id)) result.set(id, EMPTY_LINKS);
  }

  return result;
}

export function linksForBillingDocument(
  doc: { technicalCaseId: string | null; quote?: { technicalCaseId: string | null } | null },
  map: Map<string, BillingDocumentServiceLinks>,
): BillingDocumentServiceLinks {
  const caseId = pickBillingDocumentTechnicalCaseId(doc);
  if (!caseId) return EMPTY_LINKS;
  return map.get(caseId) ?? EMPTY_LINKS;
}

export async function loadBillingDocumentServiceLinksForDocument(doc: {
  technicalCaseId: string | null;
  quote?: { technicalCaseId: string | null } | null;
}): Promise<BillingDocumentServiceLinks> {
  const caseId = pickBillingDocumentTechnicalCaseId(doc);
  if (!caseId) return EMPTY_LINKS;
  const map = await batchLoadBillingDocumentServiceLinks([caseId]);
  return map.get(caseId) ?? EMPTY_LINKS;
}
