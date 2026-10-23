import type { Role } from "@/lib/roles";
import type { Custody } from "@/lib/custody";

export type ServicioBandejaColumns = {
  diagnostico: boolean;
  ordenServicio: boolean;
  equipo: boolean;
  cliente: boolean;
  edoTecnico: boolean;
  edoAdministrativo: boolean;
  edoFisico: boolean;
  vendedor: boolean;
  tecnico: boolean;
  sla: boolean;
};

export function serviciosBandejaColumns(role: Role): ServicioBandejaColumns {
  const hideAdmin = (
    role === "TECNICO"
    || role === "GERENTE_OPERATIVO_SYSTRON"
    || role === "GERENTE_OPERATIVO_SERVOMOTORES"
    || role === "SUPERVISOR_TECNICO"
  );
  const tecnicoView = role === "TECNICO";
  return {
    diagnostico: true,
    ordenServicio: true,
    equipo: true,
    cliente: true,
    edoTecnico: true,
    edoAdministrativo: !hideAdmin,
    edoFisico: !tecnicoView,
    vendedor: role !== "VENTAS",
    tecnico: !tecnicoView,
    sla: true,
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
  ENTREGADO: "Entregado",
} as const;

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
  if (value === "PENDIENTE_INGRESO") {
    return { label: "Por ingresar", tone: "warn" };
  }
  if (value === "EN_RESGUARDO") {
    return { label: "En resguardo", tone: "ok" };
  }
  if (value === "FUERA_A_PRUEBA" || value === "EN_PROVEEDOR") {
    return { label: "En pruebas", tone: "info" };
  }
  if (value === "FUERA" || value === "SIN_CUSTODIA") {
    return { label: "Entregado", tone: "neutral" };
  }
  return { label: custody, tone: "neutral" };
}

type AdminInput = {
  attentionType: string;
  quoteStatus: string | null;
  quotePending: boolean;
  warrantyDecision: string | null;
};

export function administrativeStatus(input: AdminInput): StackedStatus {
  const tags: string[] = [];

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
