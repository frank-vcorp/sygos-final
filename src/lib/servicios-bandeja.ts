import type { Role } from "@/lib/roles";
import type { Custody } from "@/lib/custody";

export type ServicioBandejaColumns = {
  atencionVigente: boolean;
  diagnostico: boolean;
  ordenServicio: boolean;
  equipo: boolean;
  cliente: boolean;
  edoTecnico: boolean;
  edoAdministrativo: boolean;
  cotizacion: boolean;
  cotizacionMonto: boolean;
  vendedor: boolean;
  tecnico: boolean;
  sla: boolean;
};

export type ServicioBandejaColumnKey = keyof ServicioBandejaColumns;

export type ServicioBandejaColumnOptions = {
  /** En Ventas, oculta la columna Monto (p. ej. panel «Cotizaciones / seguimientos»). */
  quoteMonto?: boolean;
  /** Muestra Cotización (y Monto si aplica) como primera(s) columna(s). */
  cotizacionFirst?: boolean;
  /** En Ventas, incluye edo. técnico, Técnico y SLA (p. ej. panel Cotizaciones / seguimientos). */
  tallerColumns?: boolean;
};

const BANDEJA_COLUMN_SEQUENCE: ServicioBandejaColumnKey[] = [
  "atencionVigente",
  "diagnostico",
  "ordenServicio",
  "equipo",
  "cliente",
  "edoTecnico",
  "edoAdministrativo",
  "vendedor",
  "tecnico",
  "sla",
  "cotizacion",
  "cotizacionMonto",
];

export function orderedBandejaColumns(
  columns: ServicioBandejaColumns,
  options?: ServicioBandejaColumnOptions,
): ServicioBandejaColumnKey[] {
  const active = BANDEJA_COLUMN_SEQUENCE.filter((key) => columns[key]);
  if (!options?.cotizacionFirst) return active;
  const lead = active.filter((key) => key === "atencionVigente");
  const quote = active.filter((key) => key === "cotizacion" || key === "cotizacionMonto");
  const rest = active.filter(
    (key) => key !== "atencionVigente" && key !== "cotizacion" && key !== "cotizacionMonto",
  );
  return [...lead, ...quote, ...rest];
}

export function serviciosBandejaColumns(
  role: Role,
  options?: ServicioBandejaColumnOptions,
): ServicioBandejaColumns {
  const ventas = role === "VENTAS";
  const ventasTaller = ventas && options?.tallerColumns === true;
  const showQuoteMonto = ventas && options?.quoteMonto !== false;
  const hideAdmin = (
    role === "TECNICO"
    || role === "GERENTE_OPERATIVO_SYSTRON"
    || role === "GERENTE_OPERATIVO_SERVOMOTORES"
    || role === "SUPERVISOR_TECNICO"
  );
  const tecnicoView = role === "TECNICO";
  return {
    atencionVigente: true,
    diagnostico: true,
    ordenServicio: true,
    equipo: true,
    cliente: true,
    edoTecnico: !ventas || ventasTaller,
    edoAdministrativo: !hideAdmin,
    cotizacion: ventas,
    cotizacionMonto: showQuoteMonto,
    vendedor: !ventas,
    tecnico: !tecnicoView && (!ventas || ventasTaller),
    sla: !ventas || ventasTaller,
  };
}

export type StatusTone = "neutral" | "ok" | "warn" | "danger" | "info";

export type StackedStatus = {
  label: string;
  tone: StatusTone;
  tags?: string[];
};

/** Etiqueta principal del edo. administrativo en bandejas. */
export const ADMIN_ESTADO = {
  SIN_COTIZAR: "Sin cotizar",
  COTIZADO: "Cotizado",
  DX_SIN_REPARACION: "DX sin reparación",
} as const;

/** Subestados (segunda línea) bajo el edo. administrativo. */
export const ADMIN_SUBESTADO = {
  AUTORIZADO: "Autorizado",
  NO_AUTORIZADO: "No autorizado",
} as const;

export const TECHNICAL_ESTADO = {
  VALIDADO: "Validado",
} as const;

export const PHYSICAL_ESTADO = {
  POR_INGRESAR: "Por ingresar",
  EN_RESGUARDO: "En resguardo",
  ENTREGADO: "Entregado",
} as const;

export function physicalEstadoEsEntregadoAlCliente(physical: StackedStatus) {
  return physical.label === PHYSICAL_ESTADO.ENTREGADO;
}

export function stackedHasTag(status: StackedStatus, tag: string) {
  return status.tags?.includes(tag) ?? false;
}

export function stackedWithoutSubestados(status: StackedStatus) {
  return !status.tags?.length;
}

const TECHNICAL_LABEL = {
  PENDIENTE: "Pendiente",
  EN_PROCESO: "En proceso",
  EN_VALIDACION: "En validación",
  VALIDADO: "Validado",
} as const;

export function technicalStatusFromCase(status: string): StackedStatus {
  if (status === "EN_ESPERA") {
    return { label: TECHNICAL_LABEL.PENDIENTE, tone: "warn" };
  }
  if (["EN_DIAGNOSTICO", "EN_REPARACION", "DEVUELTO"].includes(status)) {
    return { label: TECHNICAL_LABEL.EN_PROCESO, tone: "info" };
  }
  if (status === "EN_ESPERA_REFACCIONES") {
    return { label: TECHNICAL_LABEL.EN_PROCESO, tone: "info", tags: ["En espera de refacciones"] };
  }
  if (status === "PENDIENTE_VALIDACION") {
    return { label: TECHNICAL_LABEL.EN_VALIDACION, tone: "warn" };
  }
  if (status === "VALIDADO" || status === "TERMINADA" || status === "SIN_REPARACION") {
    return { label: TECHNICAL_LABEL.VALIDADO, tone: "ok" };
  }
  return { label: status, tone: "neutral" };
}

export function physicalStatusFromCustody(custody: string): StackedStatus {
  const value = custody as Custody;
  if (value === "PENDIENTE_INGRESO" || value === "SIN_CUSTODIA") {
    return { label: PHYSICAL_ESTADO.POR_INGRESAR, tone: "warn" };
  }
  if (value === "EN_RESGUARDO") {
    return { label: PHYSICAL_ESTADO.EN_RESGUARDO, tone: "ok" };
  }
  if (value === "FUERA_A_PRUEBA" || value === "EN_PROVEEDOR") {
    return { label: "En pruebas", tone: "info" };
  }
  if (value === "FUERA") {
    return { label: PHYSICAL_ESTADO.ENTREGADO, tone: "neutral" };
  }
  return { label: custody, tone: "neutral" };
}

type AdminInput = {
  attentionType: string;
  quoteStatus: string | null;
  quotePending: boolean;
  warrantyDecision: string | null;
  diagnosisNoRepair?: boolean;
};

export function administrativeStatus(input: AdminInput): StackedStatus {
  const tags: string[] = [];

  if (input.diagnosisNoRepair) {
    return { label: ADMIN_ESTADO.DX_SIN_REPARACION, tone: "ok" };
  }

  if (input.attentionType === "REPARACION") {
    if (input.quoteStatus === "NO_AUTORIZADA") tags.push(ADMIN_SUBESTADO.NO_AUTORIZADO);
    else tags.push(ADMIN_SUBESTADO.AUTORIZADO);
    return { label: ADMIN_ESTADO.SIN_COTIZAR, tone: "warn", tags };
  }

  if (input.quoteStatus === "NO_AUTORIZADA") {
    tags.push(ADMIN_SUBESTADO.NO_AUTORIZADO);
    return { label: ADMIN_ESTADO.COTIZADO, tone: "info", tags };
  }
  if (input.quoteStatus === "PENDIENTE_DECISION") {
    return { label: ADMIN_ESTADO.COTIZADO, tone: "info" };
  }
  if (input.quoteStatus?.startsWith("AUTORIZADA")) {
    tags.push(ADMIN_SUBESTADO.AUTORIZADO);
    return { label: ADMIN_ESTADO.COTIZADO, tone: "info", tags };
  }
  if (input.quoteStatus === "PENDIENTE_COTIZAR" || input.quotePending) {
    return { label: ADMIN_ESTADO.SIN_COTIZAR, tone: "warn" };
  }
  if (input.warrantyDecision === "NO_PROCEDENTE") {
    return { label: ADMIN_ESTADO.SIN_COTIZAR, tone: "warn" };
  }
  return { label: ADMIN_ESTADO.SIN_COTIZAR, tone: "warn" };
}

export function formatEquipmentBandejaLabel(equipment: {
  folio: string;
  typeName: string | null;
  brandName: string | null;
  model: string;
}) {
  const spec = [equipment.typeName, equipment.brandName, equipment.model].filter(Boolean).join(" | ");
  return spec ? `${equipment.folio} | ${spec}` : equipment.folio;
}

export function equipmentDetailHref(kind: string, equipmentId: string) {
  return kind === "MOT" ? `/motores/${equipmentId}` : `/equipos/${equipmentId}`;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

/** Fecha corta para bandejas de servicios: `2/nov/2026` (zona Ciudad de México). */
export function formatServiciosBandejaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const monthIndex = Number(parts.find((part) => part.type === "month")?.value) - 1;
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const mes = MESES_CORTOS[monthIndex] ?? "";
  return `${day}/${mes}/${year}`;
}

/** Tono de prioridad congelada (Normal / Alta / Exprés) para texto en bandejas. */
export function priorityNameTone(name: string): StatusTone {
  const normalized = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (normalized.includes("expres")) return "danger";
  if (normalized.includes("alta")) return "warn";
  return "neutral";
}
