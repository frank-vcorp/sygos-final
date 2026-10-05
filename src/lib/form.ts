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
