export const ATTENTION_TYPES = ["DIAGNOSTICO", "REPARACION", "REPARACION_TALLER", "DIAGNOSTICO_GARANTIA"] as const;
export type AttentionType = (typeof ATTENTION_TYPES)[number];

export const ATTENTION_LABEL: Record<AttentionType, string> = {
  DIAGNOSTICO: "Diagnóstico",
  REPARACION: "Reparación Express",
  REPARACION_TALLER: "Reparación / servicio taller",
  DIAGNOSTICO_GARANTIA: "Diagnóstico de Garantía",
};

/** Motivo de entrada en almacén para atenciones REPARACION (Reparación Express). */
export const REPARACION_RECEIPT_REASON = "Reparación Express";

/** Motivo de entrada para COTOS (reparación taller, no Express). */
export const REPARACION_TALLER_RECEIPT_REASON = "Reparación taller";

export function isReparacionExpressAttentionType(attentionType: string): boolean {
  return attentionType === "REPARACION";
}

export function isReparacionTallerAttentionType(attentionType: string): boolean {
  return attentionType === "REPARACION_TALLER";
}

/** Prioridad congelada al alta de Reparación Express (sin catálogo ni SLA por días). */
export function reparacionExpressFrozenPriority() {
  return {
    name: "Express",
    price: null as number | null,
    incrementPct: null as number | null,
    targetMinDays: null as number | null,
    targetMaxDays: null as number | null,
    slaMaxDays: 0,
  };
}

export function isAttentionType(value: string): value is AttentionType {
  return (ATTENTION_TYPES as readonly string[]).includes(value);
}

export const PRIORITY_EQUIPMENT_KINDS = ["EQUI", "MOT"] as const;
export type PriorityEquipmentKind = (typeof PRIORITY_EQUIPMENT_KINDS)[number];

type PrioritySeed = {
  attentionType: AttentionType;
  equipmentKind: PriorityEquipmentKind;
  name: string;
  price: number | null;
  incrementPct: number | null;
  targetMinDays: number | null;
  targetMaxDays: number | null;
  slaMaxDays: number;
  sortOrder: number;
};

const DAYS = {
  normal: { targetMinDays: 5, targetMaxDays: 10, slaMaxDays: 10, sortOrder: 1 },
  alta: { targetMinDays: 2, targetMaxDays: 5, slaMaxDays: 5, sortOrder: 2 },
  expres: { targetMinDays: null, targetMaxDays: 1, slaMaxDays: 1, sortOrder: 3 },
};

function row(
  attentionType: AttentionType,
  name: "Normal" | "Alta" | "Exprés",
  price: number | null,
  incrementPct: number | null,
  equipmentKind: PriorityEquipmentKind = "EQUI",
): PrioritySeed {
  const days = name === "Normal" ? DAYS.normal : name === "Alta" ? DAYS.alta : DAYS.expres;
  return { attentionType, equipmentKind, name, price, incrementPct, ...days };
}

/** Prioridad de diagnóstico por tipo físico (EQUI en SYSTRON, MOT en Servomotores). */
export function diagnosisPriorityEquipmentKind(
  companyCode: string | null | undefined,
  equipmentKind: "EQUI" | "MOT",
): PriorityEquipmentKind {
  if (companyCode === "SERVOMOTORES") return "MOT";
  return equipmentKind === "MOT" ? "MOT" : "EQUI";
}

/** Initial catalogs. EQUI diagnóstico en SYSTRON; MOT diagnóstico separado (SM y MOT en SYSTRON). */
export function initialPriorities(companyCode: "SYSTRON" | "SERVOMOTORES"): PrioritySeed[] {
  const equiDiagnosisPrice = companyCode === "SYSTRON";
  const diagnosisMOT: PrioritySeed[] =
    companyCode === "SERVOMOTORES"
      ? [
          row("DIAGNOSTICO", "Normal", null, null, "MOT"),
          row("DIAGNOSTICO", "Alta", null, null, "MOT"),
          row("DIAGNOSTICO", "Exprés", null, null, "MOT"),
        ]
      : [
          row("DIAGNOSTICO", "Normal", null, null, "MOT"),
          row("DIAGNOSTICO", "Alta", null, null, "MOT"),
          row("DIAGNOSTICO", "Exprés", null, null, "MOT"),
        ];
  return [
    row("DIAGNOSTICO", "Normal", equiDiagnosisPrice ? 0 : null, null, "EQUI"),
    row("DIAGNOSTICO", "Alta", equiDiagnosisPrice ? 3500 : null, null, "EQUI"),
    row("DIAGNOSTICO", "Exprés", equiDiagnosisPrice ? 4500 : null, null, "EQUI"),
    ...diagnosisMOT,
    row("REPARACION", "Normal", null, 0),
    row("REPARACION", "Alta", null, 10),
    row("REPARACION", "Exprés", null, 20),
    row("REPARACION_TALLER", "Normal", null, 0),
    row("REPARACION_TALLER", "Alta", null, 10),
    row("REPARACION_TALLER", "Exprés", null, 20),
    row("DIAGNOSTICO_GARANTIA", "Normal", 0, null),
    row("DIAGNOSTICO_GARANTIA", "Alta", 0, null),
    row("DIAGNOSTICO_GARANTIA", "Exprés", 0, null),
  ];
}

export function prioritySummary(input: {
  name: string;
  price: number | null;
  incrementPct: number | null;
  targetMinDays: number | null;
  targetMaxDays: number | null;
  slaMaxDays: number;
}): string {
  const days =
    input.targetMinDays != null && input.targetMaxDays != null
      ? `${input.targetMinDays}-${input.targetMaxDays} días hábiles`
      : `${input.slaMaxDays} día hábil`;
  const money =
    input.incrementPct != null
      ? `incremento ${input.incrementPct}%`
      : input.price == null
        ? "precio sin definir"
        : `$${input.price.toLocaleString("es-MX")}`;
  return `${input.name} · ${money} · objetivo ${days} · SLA máximo ${input.slaMaxDays}`;
}
