export const QUOTE_LINE_CONDITIONS = ["NUEVO", "USADO"] as const;
export type QuoteLineCondition = (typeof QUOTE_LINE_CONDITIONS)[number];

export const QUOTE_LINE_CONDITION_LABEL: Record<QuoteLineCondition, string> = {
  NUEVO: "Nuevo",
  USADO: "Usado",
};

export const DEFAULT_QUOTE_LINE_CONDITION: QuoteLineCondition = "NUEVO";

export function isQuoteLineCondition(value: string): value is QuoteLineCondition {
  return (QUOTE_LINE_CONDITIONS as readonly string[]).includes(value);
}

export function parseQuoteLineCondition(raw: unknown, label = "Condición"): QuoteLineCondition {
  const text = typeof raw === "string" ? raw.trim() : raw === null || raw === undefined ? "" : String(raw).trim();
  if (!text) return DEFAULT_QUOTE_LINE_CONDITION;
  if (!isQuoteLineCondition(text)) throw new Error(`${label} debe ser Nuevo o Usado.`);
  return text;
}

export function quoteLineConditionLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  if (isQuoteLineCondition(value)) return QUOTE_LINE_CONDITION_LABEL[value];
  return value;
}