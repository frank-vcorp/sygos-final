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

export type ServiciosVista = "activos" | "historial";

export type ServiciosListParams = {
  vista?: ServiciosVista;
  tipo?: string;
  /** Filtro comercial (catálogo gerente/ventas) o estado de operación en historial técnico */
  estado?: string;
  q?: string;
  desde?: string;
  hasta?: string;
};

export function parseServiciosVista(vista: string | undefined): ServiciosVista {
  return vista === "historial" ? "historial" : "activos";
}

/** Fecha `YYYY-MM-DD` en zona Ciudad de México; inicio del día o fin del día. */
export function parseServiciosDateBoundary(value: string | undefined, endOfDay: boolean): Date | null {
  const raw = value?.trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const suffix = endOfDay ? "T23:59:59.999-06:00" : "T00:00:00.000-06:00";
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const SERVICIOS_BANDEJA_ACTIVOS = "/servicios/activos";
export const SERVICIOS_BANDEJA_HISTORIAL = "/servicios/historial";

function serviciosSearchParams(params: ServiciosListParams) {
  const search = new URLSearchParams();
  if (params.tipo && params.tipo !== "todos") search.set("tipo", params.tipo);
  if (params.estado && params.estado !== "todos") search.set("estado", params.estado);
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.desde?.trim()) search.set("desde", params.desde.trim());
  if (params.hasta?.trim()) search.set("hasta", params.hasta.trim());
  return search;
}

/** Catálogo comercial (gerente, ventas, etc.). */
export function serviciosListHref(params: ServiciosListParams = {}) {
  const search = serviciosSearchParams(params);
  const query = search.toString();
  return query ? `/servicios?${query}` : "/servicios";
}

/** Bandeja técnica (técnico y supervisor). */
export function serviciosBandejaHref(params: ServiciosListParams = {}) {
  const base = params.vista === "historial" ? SERVICIOS_BANDEJA_HISTORIAL : SERVICIOS_BANDEJA_ACTIVOS;
  const search = serviciosSearchParams(params);
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function usesServiciosBandeja(role: string) {
  return role === "SUPERVISOR_TECNICO" || role === "TECNICO";
}

export function serviciosTipoHref(tipo: ServicioTipoParam, q?: string) {
  const search = new URLSearchParams();
  if (q?.trim()) search.set("q", q.trim());
  const query = search.toString();
  return query ? `/servicios/${tipo}?${query}` : `/servicios/${tipo}`;
}

export const SUPERVISOR_SERVICIO_SECTIONS: Array<{ param: ServicioTipoParam; menuLabel: string; title: string }> = [
  { param: "diagnostico", menuLabel: "Diagnósticos", title: "Diagnósticos" },
  { param: "reparacion", menuLabel: "Reparaciones", title: "Reparaciones" },
  { param: "garantia", menuLabel: "Garantías", title: "Garantías" },
];

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
