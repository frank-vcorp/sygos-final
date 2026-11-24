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