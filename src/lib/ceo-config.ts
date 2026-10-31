/** Presupuesto mensual inicial de compras de refacciones. */
export const PARTS_MONTHLY_BUDGET_DEFAULT = 100_000;
/** Presupuesto mensual inicial de compras generales. */
export const GENERAL_MONTHLY_BUDGET_DEFAULT = 5_000;

export const COMMERCIAL_GOAL_METRICS = [
  { id: "FACTURACION", label: "Facturación" },
  { id: "COBRANZA", label: "Cobranza / Pagos" },
] as const;

export type CommercialGoalMetric = (typeof COMMERCIAL_GOAL_METRICS)[number]["id"];

export function isCommercialGoalMetric(value: string): value is CommercialGoalMetric {
  return COMMERCIAL_GOAL_METRICS.some((metric) => metric.id === value);
}

export function parseYearMonth(value: string | null | undefined): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec((value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

/** Mes civil en hora de México, alineado al corte de facturación (06:00 UTC). */
export function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1, 6, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 6, 0, 0));
  return { start, end };
}

export function currentYearMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  return parseYearMonth(parts.slice(0, 7)) ?? { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function formatYearMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseClabe(value: string): string {
  const digits = value.replace(/\s+/g, "");
  if (!/^\d{18}$/.test(digits)) throw new Error("La CLABE debe tener 18 dígitos.");
  return digits;
}

export function accountKindLabel(kind: string) {
  if (kind === "BANCO") return "Cuenta bancaria";
  if (kind === "EFECTIVO") return "Efectivo";
  if (kind === "TARJETA") return "Tarjeta";
  return kind;
}
