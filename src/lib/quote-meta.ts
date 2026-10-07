export const QUOTE_TYPES = ["DIAGNOSTICO", "REPARACION", "CAMPO", "VENTA_EQUIPO"] as const;
export type QuoteType = (typeof QUOTE_TYPES)[number];

export const QUOTE_TYPE_LABEL: Record<QuoteType, string> = {
  DIAGNOSTICO: "Diagnóstico",
  REPARACION: "Reparación/Servicio",
  CAMPO: "Servicio en campo",
  VENTA_EQUIPO: "Venta de equipo",
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  PENDIENTE_COTIZAR: "Pendiente de cotizar",
  PENDIENTE_DECISION: "Pendiente de decisión",
  AUTORIZADA: "Autorizada",
  NO_AUTORIZADA: "No autorizada",
  AUTORIZADA_PENDIENTE_EQUIPO: "Autorizada — pendiente de ingreso de equipo",
};
