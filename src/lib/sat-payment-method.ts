import catalog from "./sat/c_MetodoPago.json";
import formaPagoCatalog from "./sat/c_FormaPago.json";
import { normalizeOperationalPaymentType, type OperationalPaymentType } from "./finance-accounts";

type SatMetodoPago = { id: string; descripcion: string };
type SatFormaPago = { id: string; descripcion: string };

/** Catálogo c_MetodoPago del SAT (CFDI). */
export const SAT_METODO_PAGO: SatMetodoPago[] = catalog as SatMetodoPago[];
/** Catálogo c_FormaPago del SAT (CFDI). */
export const SAT_FORMA_PAGO: SatFormaPago[] = formaPagoCatalog as SatFormaPago[];

const codes = new Set(SAT_METODO_PAGO.map((row) => row.id));
const formaPagoCodes = new Set(SAT_FORMA_PAGO.map((row) => row.id));

export function paymentMethodLabel(code: string | null | undefined): string {
  if (!code) return "Sin definir";
  const row = SAT_METODO_PAGO.find((item) => item.id === code);
  return row ? `${row.id} — ${row.descripcion}` : code;
}

export function paymentFormLabel(code: string | null | undefined): string {
  if (!code) return "Sin definir";
  const row = SAT_FORMA_PAGO.find((item) => item.id === code);
  return row ? `${row.id} — ${row.descripcion}` : code;
}

export function parsePaymentMethod(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (!code) return null;
  if (!codes.has(code)) throw new Error("El método de pago debe ser PUE o PPD.");
  return code;
}

/** c_FormaPago derivado del método (timbrado CFDI). PUE/PPD no cambian. */
export function paymentFormForMethod(method: string): string {
  if (method === "PPD") return "99";
  if (method === "PUE") return "03";
  throw new Error("Método de pago no válido.");
}

/** SAT c_FormaPago alineado a tesorería operativa (cobros / compras). */
export function satFormaPagoForOperationalPayment(paymentType: string): string {
  const normalized = normalizeOperationalPaymentType(paymentType) as OperationalPaymentType;
  const map: Record<string, string> = {
    EFECTIVO: "01",
    TRANSFERENCIA: "03",
    TD: "28",
    TC: "04",
    CREDITO: "99",
  };
  const code = map[normalized] ?? "99";
  if (!formaPagoCodes.has(code)) throw new Error("Forma de pago SAT no válida.");
  return code;
}
