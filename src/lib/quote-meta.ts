export const QUOTE_TYPES = ["DIAGNOSTICO", "REPARACION", "MANTENIMIENTO_PREVENTIVO", "CAMPO", "VENTA_EQUIPO", "SERVICIOS_EXISTENTES"] as const;
export type QuoteType = (typeof QUOTE_TYPES)[number];

export const QUOTE_TYPE_LABEL: Record<QuoteType, string> = {
  DIAGNOSTICO: "Diagnóstico",
  REPARACION: "Reparación/Servicio",
  MANTENIMIENTO_PREVENTIVO: "Mantenimiento preventivo",
  CAMPO: "Servicio en campo",
  VENTA_EQUIPO: "Venta de equipo",
  SERVICIOS_EXISTENTES: "Servicios existentes",
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  PENDIENTE_COTIZAR: "Pendiente de cotizar",
  PENDIENTE_DECISION: "Pendiente de decisión",
  AUTORIZADA: "Autorizada",
  NO_AUTORIZADA: "No autorizada",
  AUTORIZADA_PENDIENTE_EQUIPO: "Autorizada — pendiente de ingreso de equipo",
};
