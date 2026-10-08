import { prisma } from "@/lib/db";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";

export const SERVICIO_TIPO_PARAM = {
  diagnostico: "DIAGNOSTICO",
  reparacion: "REPARACION",
  garantia: "DIAGNOSTICO_GARANTIA",
} as const;

export type ServicioTipoParam = keyof typeof SERVICIO_TIPO_PARAM;

export const SERVICIO_TIPO_OPTIONS: Array<{ param: ServicioTipoParam; label: string }> = [
  { param: "diagnostico", label: ATTENTION_LABEL.DIAGNOSTICO },
  { param: "reparacion", label: ATTENTION_LABEL.REPARACION },
  { param: "garantia", label: ATTENTION_LABEL.DIAGNOSTICO_GARANTIA },
];

export function servicioTipoLabel(attentionType: string): string {
  return ATTENTION_LABEL[attentionType as AttentionType] ?? attentionType;
}

export function parseServicioTipo(tipo: string | undefined): AttentionType | null {
  if (!tipo || tipo === "todos") return null;
  const mapped = SERVICIO_TIPO_PARAM[tipo as ServicioTipoParam];
  return mapped ?? null;
}

export function serviciosListHref(params: { tipo?: string; estado?: string; q?: string }) {
  const search = new URLSearchParams();
  if (params.tipo && params.tipo !== "todos") search.set("tipo", params.tipo);
  if (params.estado && params.estado !== "todos") search.set("estado", params.estado);
  if (params.q?.trim()) search.set("q", params.q.trim());
  const query = search.toString();
  return query ? `/servicios?${query}` : "/servicios";
}

type SessionScope = {
  userId: string;
  role: string;
  activeCompanyId: string;
  activeCompanyCode: string | null;
};

export async function equipmentScopeForServicios(session: SessionScope) {
  const systron = session.activeCompanyCode === "SERVOMOTORES"
    ? await prisma.company.findUnique({ where: { code: "SYSTRON" } })
    : null;
  return {
    ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}),
    ...(session.activeCompanyCode === "SYSTRON"
      ? { originCompanyId: session.activeCompanyId }
      : {
          kind: "MOT" as const,
          OR: [{ originCompanyId: session.activeCompanyId }, ...(systron ? [{ originCompanyId: systron.id }] : [])],
        }),
  };
}
