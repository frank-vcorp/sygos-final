export class ConcurrencyError extends Error {
  constructor() {
    super("Este registro cambió desde que lo abriste. Recarga el detalle antes de continuar.");
    this.name = "ConcurrencyError";
  }
}

export function parseVersion(value: FormDataEntryValue | null): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return -1;
  return n;
}

export function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function requiredText(value: FormDataEntryValue | null, label: string): string {
  const text = optionalText(value);
  if (!text) throw new Error(`${label} es obligatorio.`);
  return text;
}

export function optionalInt(value: FormDataEntryValue | null): number | null {
  const text = optionalText(value);
  if (!text) return null;
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0) throw new Error("El número indicado no es válido.");
  return n;
}

export function optionalBool(value: FormDataEntryValue | null): boolean | null {
  const text = optionalText(value);
  if (!text) return null;
  if (text === "si") return true;
  if (text === "no") return false;
  throw new Error("Selecciona Sí o No.");
}

export function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const MEXICO_LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const MEXICO_LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Interpreta entradas de `<input type="datetime-local">` o `date` como hora de Ciudad de México (UTC-6),
 * manteniendo soporte para cadenas ISO con zona explícita.
 */
export function parseMexicoDateTimeInput(value: FormDataEntryValue | null): Date | null {
  const text = optionalText(value);
  if (!text) return null;
  const dtMatch = MEXICO_LOCAL_DATETIME.exec(text);
  if (dtMatch) {
    const [, y, m, d, hh, mm, ss = "00"] = dtMatch;
    const parsed = new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}-06:00`);
    if (Number.isNaN(parsed.getTime())) throw new Error("La fecha no es válida.");
    return parsed;
  }
  const dateMatch = MEXICO_LOCAL_DATE.exec(text);
  if (dateMatch) {
    const [, y, m, d] = dateMatch;
    const parsed = new Date(`${y}-${m}-${d}T12:00:00-06:00`);
    if (Number.isNaN(parsed.getTime())) throw new Error("La fecha no es válida.");
    return parsed;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new Error("La fecha no es válida.");
  return parsed;
}

/** Formatea una fecha a `YYYY-MM-DDTHH:mm` en hora de Ciudad de México para `<input type="datetime-local">`. */
export function formatMexicoDateTimeLocalValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
