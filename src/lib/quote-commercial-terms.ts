export const QUOTE_WARRANTY_MONTHS = [3, 6, 9, 12] as const;
export type QuoteWarrantyMonths = (typeof QUOTE_WARRANTY_MONTHS)[number];

export const DEFAULT_QUOTE_WARRANTY_MONTHS: QuoteWarrantyMonths = 12;

export const QUOTE_PAYMENT_CONDITIONS = ["ANTICIPADO", "CONTADO", "CREDITO"] as const;
export type QuotePaymentCondition = (typeof QUOTE_PAYMENT_CONDITIONS)[number];

export const DEFAULT_QUOTE_PAYMENT_CONDITION: QuotePaymentCondition = "CONTADO";

/** Plazo sugerido al elegir condición de pago Crédito (30 días). */
export const DEFAULT_QUOTE_CREDIT_DAYS = 30;

/** Valores por defecto al invocar createSellerQuote en pruebas o rutas sin formulario. */
export const defaultSellerQuoteCommercialTerms = {
  warrantyMonths: DEFAULT_QUOTE_WARRANTY_MONTHS,
  paymentCondition: DEFAULT_QUOTE_PAYMENT_CONDITION,
} as const;

export const QUOTE_PAYMENT_CONDITION_LABEL: Record<QuotePaymentCondition, string> = {
  ANTICIPADO: "Anticipado",
  CONTADO: "Contado",
  CREDITO: "Crédito",
};

export function isQuotePaymentCondition(value: string): value is QuotePaymentCondition {
  return (QUOTE_PAYMENT_CONDITIONS as readonly string[]).includes(value);
}

export function parseWarrantyMonths(raw: unknown): QuoteWarrantyMonths {
  const text = typeof raw === "string" ? raw.trim() : raw === null || raw === undefined ? "" : String(raw).trim();
  if (!text) throw new Error("Selecciona los meses de garantía.");
  const n = Number.parseInt(text, 10);
  if (!(QUOTE_WARRANTY_MONTHS as readonly number[]).includes(n)) {
    throw new Error("La garantía debe ser 3, 6, 9 o 12 meses.");
  }
  return n as QuoteWarrantyMonths;
}

export function parsePaymentCondition(raw: unknown): QuotePaymentCondition {
  const text = typeof raw === "string" ? raw.trim() : raw === null || raw === undefined ? "" : String(raw).trim();
  if (!text) throw new Error("Selecciona las condiciones de pago.");
  if (!isQuotePaymentCondition(text)) throw new Error("Las condiciones de pago no son válidas.");
  return text;
}

/** Valor inicial del campo días de crédito según condición y datos existentes. */
export function quoteCreditDaysFieldValue(
  paymentCondition: string | null | undefined,
  creditDays: number | null | undefined,
): string {
  if (paymentCondition !== "CREDITO") return "";
  if (creditDays != null && creditDays > 0) return String(creditDays);
  return String(DEFAULT_QUOTE_CREDIT_DAYS);
}

/** Días de crédito congelados en la cotización cuando la condición es CREDITO. */
export function parseQuoteCreditDays(
  paymentCondition: QuotePaymentCondition,
  raw: unknown,
): number | null {
  if (paymentCondition !== "CREDITO") return null;
  const text = typeof raw === "string" ? raw.trim() : raw === null || raw === undefined ? "" : String(raw).trim();
  if (!text) return DEFAULT_QUOTE_CREDIT_DAYS;
  const n = Number.parseInt(text, 10);
  if (!Number.isInteger(n) || n < 1) throw new Error("Los días de crédito deben ser un entero mayor o igual a 1.");
  return n;
}

export function warrantyMonthsLabel(months: number | null | undefined): string | null {
  if (months == null) return null;
  return `${months} meses de garantía`;
}

/** Texto para documento/detalle; respeta cotizaciones previas sin `paymentCondition`. */
export function quotePaymentConditionDisplay(
  paymentCondition: string | null | undefined,
  creditDays: number | null | undefined,
): string {
  if (paymentCondition && isQuotePaymentCondition(paymentCondition)) {
    const label = QUOTE_PAYMENT_CONDITION_LABEL[paymentCondition];
    if (paymentCondition === "CREDITO" && creditDays != null && creditDays > 0) {
      return `${label} (${creditDays} días)`;
    }
    return label;
  }
  if (creditDays != null && creditDays > 0) return `${creditDays} días de crédito`;
  return QUOTE_PAYMENT_CONDITION_LABEL.CONTADO;
}