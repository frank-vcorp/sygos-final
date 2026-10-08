import catalog from "./sat/c_MetodoPago.json";

type SatMetodoPago = { id: string; descripcion: string };

/** Catálogo c_MetodoPago del SAT (CFDI). */
export const SAT_METODO_PAGO: SatMetodoPago[] = catalog as SatMetodoPago[];

const codes = new Set(SAT_METODO_PAGO.map((row) => row.id));

export function paymentMethodLabel(code: string | null | undefined): string {
  if (!code) return "Sin definir";
  const row = SAT_METODO_PAGO.find((item) => item.id === code);
  return row ? `${row.id} — ${row.descripcion}` : code;
}

export function parsePaymentMethod(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!code) return null;
  if (!codes.has(code)) throw new Error("El método de pago debe ser PUE o PPD.");
  return code;
}

/** c_FormaPago derivado del método (timbrado). */
export function paymentFormForMethod(method: string): string {
  if (method === "PPD") return "99";
  if (method === "PUE") return "03";
  throw new Error("Método de pago no válido.");
}
