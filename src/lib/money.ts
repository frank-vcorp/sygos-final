export const IVA_RATE = 0.16;

export function lineAmount(quantity: number, unitPrice: number | null): number | null {
  if (unitPrice == null) return null;
  return roundMoney(quantity * unitPrice);
}

export function linesForTotal<T extends { authorized?: boolean }>(lines: T[], quoteType: string, status: string): T[] {
  if (quoteType === "VENTA_EQUIPO" && status === "AUTORIZADA") {
    const chosen = lines.filter((line) => line.authorized);
    if (chosen.length > 0) return chosen;
  }
  return lines;
}

export function quoteTotals(lines: Array<{ quantity: number; unitPrice: number | null }>, discountPct: number) {
  const priced = lines.every((line) => line.unitPrice != null);
  if (!priced) return null;
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.quantity * (line.unitPrice ?? 0), 0));
  const discount = roundMoney(subtotal * (discountPct / 100));
  const base = roundMoney(subtotal - discount);
  const iva = roundMoney(base * IVA_RATE);
  return { subtotal, discount, base, iva, total: roundMoney(base + iva) };
}

export function finalFromBase(base: number, incrementPct: number | null): number {
  return roundMoney(base * (1 + (incrementPct ?? 0) / 100));
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function money(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

/** Prefijo visual del monto según moneda del proveedor (MXN / USD). */
export function moneyCurrencyPrefix(currency: string | null | undefined) {
  return currency === "USD" ? "US$" : "$";
}

/** Valor mostrado en captura de importes (sin símbolo $; el prefijo va en el control). */
export function formatMoneyInput(value: number): string {
  return value.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Interpreta texto capturado o enviado por formulario (acepta comas de miles y 2 decimales). */
export function parseMoneyInput(text: string | null | undefined): number | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/\$/g, "").replace(/\s/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return roundMoney(n);
}

export function moneyFromForm(value: FormDataEntryValue | null, label = "Importe"): number {
  const raw = typeof value === "string" ? value : value != null ? String(value) : null;
  const amount = parseMoneyInput(raw);
  if (amount == null) throw new Error(`${label} es obligatorio.`);
  return amount;
}

export function optionalMoneyFromForm(value: FormDataEntryValue | null): number | null {
  const raw = typeof value === "string" ? value : value != null ? String(value) : null;
  return parseMoneyInput(raw);
}
