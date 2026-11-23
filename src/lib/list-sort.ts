export type SortDirection = "asc" | "desc";

const MONEY_RE = /-?\d[\d,]*(?:\.\d+)?/;

export function normalizeSortValue(value: unknown): string | number {
  if (value == null) return "";
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const iso = Date.parse(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(iso)) return iso;
    const money = value.replace(/\s/g, "").match(MONEY_RE);
    if (money && (value.includes("$") || value.includes(",") || /^\$?-?\d/.test(value.trim()))) {
      const n = Number(money[0].replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
    return value.toLocaleLowerCase("es-MX");
  }
  return String(value).toLocaleLowerCase("es-MX");
}

export function compareSortValues(a: unknown, b: unknown): number {
  const left = normalizeSortValue(a);
  const right = normalizeSortValue(b);
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "es-MX", { numeric: true, sensitivity: "base" });
}

export function sortRowsByColumn<T>(
  rows: T[],
  getValue: (row: T) => unknown,
  direction: SortDirection,
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => factor * compareSortValues(getValue(a), getValue(b)));
}

/** Cobranza: más tiempo vencido primero (regla de vista inicial). */
export function receivableOverdueScore(balance: number, dueAt: Date | string, now = Date.now()): number {
  const dueMs = dueAt instanceof Date ? dueAt.getTime() : Date.parse(String(dueAt));
  if (!Number.isFinite(dueMs)) return 0;
  return balance > 0 && dueMs < now ? now - dueMs : 0;
}