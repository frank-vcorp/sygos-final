import { receiptReasonFromAttention, type MovementKind } from "@/lib/custody";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { serviceSeries } from "@/lib/servicios-catalog";

type EntradaAttention = {
  status: string;
  slaStartedAt: Date | null;
  attentionType: string;
  reportedFault?: string;
};

export type EntradaServiceBadge = "DX" | "OS";

export function resolveEntradaAttentionType(
  attentions: readonly EntradaAttention[],
  quoteType?: string | null,
): string | null {
  const attention = pickEntradaAttention(attentions);
  if (attention) return attention.attentionType;
  if (quoteType === "REPARACION") return "REPARACION";
  if (quoteType === "DIAGNOSTICO") return "DIAGNOSTICO";
  return null;
}

export function entradaServiceBadge(attentionType: string | null | undefined, quoteType?: string | null): EntradaServiceBadge | null {
  const resolved = attentionType ?? (quoteType === "REPARACION" ? "REPARACION" : quoteType === "DIAGNOSTICO" ? "DIAGNOSTICO" : null);
  if (!resolved) return null;
  return serviceSeries(resolved);
}

/** Atención usable para primera entrada física (incluye casos fuera de ABIERTA estricta). */
export function pickEntradaAttention(attentions: readonly EntradaAttention[]): EntradaAttention | null {
  if (attentions.length === 0) return null;
  const abierta = attentions.find((row) => row.status === "ABIERTA");
  if (abierta) return abierta;
  const sinSla = attentions.find((row) => !row.slaStartedAt && (row.status === "ABIERTA" || row.status === "EN_PROCESO"));
  if (sinSla) return sinSla;
  return attentions[0] ?? null;
}

export function buildAlmacenEntradaPreset(input: {
  kind: "EQUI" | "MOT";
  custody: string;
  clientName: string;
  attentions: readonly EntradaAttention[];
  quoteType?: string | null;
  quoteConcept?: string | null;
}): {
  movement: MovementKind;
  reason: string;
  serviceLabel: string;
  reportedFault: string;
  clientName: string;
} {
  const movement: MovementKind =
    input.kind === "MOT" ? "INGRESO" : "ENTRADA";
  const attention = pickEntradaAttention(input.attentions);
  if (attention) {
    const reason = receiptReasonFromAttention(attention.attentionType) ?? "Diagnóstico";
    return {
      movement,
      reason,
      serviceLabel: ATTENTION_LABEL[attention.attentionType as AttentionType] ?? attention.attentionType,
      reportedFault: attention.reportedFault ?? "—",
      clientName: input.clientName,
    };
  }
  if (input.quoteType === "REPARACION" || input.quoteType === "DIAGNOSTICO") {
    const reason = input.quoteType === "REPARACION" ? "Reparación" : "Diagnóstico";
    return {
      movement,
      reason,
      serviceLabel: input.quoteType === "REPARACION" ? "Reparación" : "Diagnóstico",
      reportedFault: input.quoteConcept ?? "Servicio autorizado",
      clientName: input.clientName,
    };
  }
  return {
    movement,
    reason: "Diagnóstico",
    serviceLabel: "Ingreso a almacén",
    reportedFault: "Pendiente de detalle en operación",
    clientName: input.clientName,
  };
}
