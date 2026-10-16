import type { HistoryTimelineItem } from "@/components/history-timeline";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { CASE_STATUS_LABEL } from "@/lib/technical";

/** Roles que ven el recorrido completo (atención, físico, casos, cotizaciones) en detalle de operación. */
export function seesFullAttentionHistory(role: string) {
  return (
    role === "TECNICO"
    || role === "SUPERVISOR_TECNICO"
    || role === "GERENTE_OPERATIVO_SYSTRON"
    || role === "GERENTE_OPERATIVO_SERVOMOTORES"
    || role === "CEO"
    || role === "ADMINISTRADOR"
  );
}

type FunctionalHistorySlice = {
  id: string;
  createdAt: Date;
  action: string;
  summary: string;
  entityId: string;
  author?: { name: string } | null;
};

export function buildAttentionHistoryTimeline(input: {
  attention: {
    id: string;
    createdAt: Date;
    attentionType: string;
    priorityName: string;
    reportedFault: string;
    createdByUserId: string | null;
  };
  movements: Array<{
    id: string;
    occurredAt: Date;
    kind: string;
    folio: string | null;
    reason: string | null;
    notes: string | null;
    authorUserId: string;
  }>;
  technicalCases: Array<{
    id: string;
    folio: string;
    kind: string;
    status: string;
    createdAt: Date;
  }>;
  attentionHistory: FunctionalHistorySlice[];
  operationHistory: FunctionalHistorySlice[];
  quoteHistories: Array<{
    quoteFolio: string;
    items: Array<{
      id: string;
      createdAt: Date;
      summary: string;
      author?: { name: string } | null;
    }>;
  }>;
  authorNames: Map<string, string>;
}): HistoryTimelineItem[] {
  const casesWithOpenHistory = new Set(
    input.operationHistory.filter((item) => item.action === "ALTA").map((item) => item.entityId),
  );
  const caseById = new Map(input.technicalCases.map((item) => [item.id, item]));
  const attentionHasOpenHistory = input.attentionHistory.some((item) => item.action === "ALTA");

  return [
    ...(!attentionHasOpenHistory
      ? [{
          id: `attention-${input.attention.id}`,
          createdAt: input.attention.createdAt,
          summary: `Atención ${ATTENTION_LABEL[input.attention.attentionType as AttentionType] ?? input.attention.attentionType} abierta · prioridad ${input.attention.priorityName}. Falla reportada: ${input.attention.reportedFault}`,
          authorName: input.attention.createdByUserId ? input.authorNames.get(input.attention.createdByUserId) ?? null : null,
        }]
      : []),
    ...input.attentionHistory
      .filter((item) => item.action !== "ENTRADA_FISICA" && item.action !== "MOVIMIENTO_FISICO")
      .map((item) => ({
        id: `attention-history-${item.id}`,
        createdAt: item.createdAt,
        summary: `Atención · ${item.summary}`,
        authorName: item.author?.name,
      })),
    ...input.movements.map((item) => ({
      id: `movement-${item.id}`,
      createdAt: item.occurredAt,
      summary: [
        `Movimiento físico${item.folio ? ` ${item.folio}` : ""}: ${item.kind}`,
        item.reason,
        item.notes,
      ].filter(Boolean).join(" · "),
      authorName: input.authorNames.get(item.authorUserId),
    })),
    ...input.technicalCases.flatMap((technicalCase) =>
      !casesWithOpenHistory.has(technicalCase.id)
        ? [{
            id: `case-${technicalCase.id}`,
            createdAt: technicalCase.createdAt,
            summary: `${technicalCase.folio} · ${technicalCase.kind === "OS" ? "Orden de servicio" : "Diagnóstico"} abierta. Estado actual: ${CASE_STATUS_LABEL[technicalCase.status] ?? technicalCase.status}.`,
            authorName: null,
          }]
        : [],
    ),
    ...input.operationHistory.map((item) => ({
      id: `operation-history-${item.id}`,
      createdAt: item.createdAt,
      summary: `${caseById.get(item.entityId)?.folio ?? "Operación"} · ${item.summary}`,
      authorName: item.author?.name,
    })),
    ...input.quoteHistories.flatMap((quote) =>
      quote.items.map((item) => ({
        id: `quote-history-${item.id}`,
        createdAt: item.createdAt,
        summary: `${quote.quoteFolio} · ${item.summary}`,
        authorName: item.author?.name,
      })),
    ),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
