export const IVA_RATE = 0.16;

export function lineAmount(quantity: number, unitPrice: number | null): number | null {
  if (unitPrice == null) return null;
  return roundMoney(quantity * unitPrice);
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
