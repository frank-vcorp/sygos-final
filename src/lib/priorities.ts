export const ATTENTION_TYPES = ["DIAGNOSTICO", "REPARACION", "DIAGNOSTICO_GARANTIA"] as const;
export type AttentionType = (typeof ATTENTION_TYPES)[number];

export const ATTENTION_LABEL: Record<AttentionType, string> = {
  DIAGNOSTICO: "Diagnóstico",
  REPARACION: "Reparación",
  DIAGNOSTICO_GARANTIA: "Diagnóstico de Garantía",
};

export function isAttentionType(value: string): value is AttentionType {
  return (ATTENTION_TYPES as readonly string[]).includes(value);
}

type PrioritySeed = {
  attentionType: AttentionType;
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
): PrioritySeed {
  const days = name === "Normal" ? DAYS.normal : name === "Alta" ? DAYS.alta : DAYS.expres;
  return { attentionType, name, price, incrementPct, ...days };
}

/** Initial catalogs. Diagnosis prices are the documented SYSTRON values; Servomotores starts without those prices. */
export function initialPriorities(companyCode: "SYSTRON" | "SERVOMOTORES"): PrioritySeed[] {
  const diagnosisPrice = companyCode === "SYSTRON";
  return [
    row("DIAGNOSTICO", "Normal", diagnosisPrice ? 0 : null, null),
    row("DIAGNOSTICO", "Alta", diagnosisPrice ? 3500 : null, null),
    row("DIAGNOSTICO", "Exprés", diagnosisPrice ? 4500 : null, null),
    row("REPARACION", "Normal", null, 0),
    row("REPARACION", "Alta", null, 10),
    row("REPARACION", "Exprés", null, 20),
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
