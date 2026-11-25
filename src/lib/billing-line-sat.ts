import { SAT_UNIT_OPTIONS } from "@/lib/sat-unit-options";

export function billingLineSatKeysEditable(document: {
  status: string;
  kind: string;
  fiscalStatus: string | null;
}): boolean {
  if (document.kind === "REMISION") return false;
  if (document.status === "SOLICITADA") return true;
  if (document.status !== "EMITIDA") return false;
  const fiscal = document.fiscalStatus ?? "PENDIENTE";
  return fiscal === "PENDIENTE" || fiscal === "ERROR" || fiscal === "PROCESANDO";
}

export function parseSatProductKey(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length !== 8) {
    throw new Error("La clave producto/servicio debe tener 8 dígitos (c_ClaveProdServ).");
  }
  return digits;
}

export function parseSatUnitKey(raw: string): string {
  const key = String(raw ?? "").trim().toUpperCase();
  if (!key) {
    throw new Error("La clave de unidad es obligatoria (c_ClaveUnidad).");
  }
  return key.slice(0, 8);
}

export function resolveSatUnitName(unitKey: string): string {
  const normalized = unitKey.trim().toUpperCase();
  const match = SAT_UNIT_OPTIONS.find((row) => row.id === normalized);
  return match?.name ?? normalized;
}

export const BILLING_SAT_KEYS_ISSUE_ERROR =
  "Completa la clave producto/servicio (8 dígitos) y la clave de unidad en cada línea antes de emitir o timbrar.";

export function billingLineHasCompleteSatKeys(line: {
  satProductKey: string | null;
  satUnitKey: string | null;
}): boolean {
  const productDigits = String(line.satProductKey ?? "").replace(/\D/g, "");
  const unitKey = String(line.satUnitKey ?? "").trim();
  return productDigits.length === 8 && unitKey.length > 0;
}

export function billingDocumentSatKeysComplete(
  document: { kind: string; lines: Array<{ satProductKey: string | null; satUnitKey: string | null }> },
): boolean {
  if (document.kind === "REMISION") return true;
  if (document.lines.length === 0) return false;
  return document.lines.every((line) => billingLineHasCompleteSatKeys(line));
}

export function assertBillingDocumentSatKeysForFiscal(document: {
  kind: string;
  lines: Array<{ satProductKey: string | null; satUnitKey: string | null }>;
}): void {
  if (document.kind === "REMISION") return;
  if (!billingDocumentSatKeysComplete(document)) {
    throw new Error(BILLING_SAT_KEYS_ISSUE_ERROR);
  }
}