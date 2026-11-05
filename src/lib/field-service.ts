import { prisma } from "./db";
import { allocateFolio } from "./folios";
import { recordHistory } from "./history";
import { finalFromBase } from "./money";

export const FIELD_SERVICE_CONCEPT = "Servicio de Campo";
export const FIELD_SERVICE_DEFAULT_HOURS = 4;

export const FIELD_SERVICE_STATUS_LABEL: Record<string, string> = {
  ABIERTO: "Abierto",
  CERRADO: "Cerrado",
};

export function fieldServiceTotal(hours: number, unitPrice: number) {
  return hours * unitPrice;
}

type FrozenQuote = {
  id: string;
  companyId: string;
  clientId: string;
  sellerUserId: string | null;
  lines: Array<{ concept: string; authorized: boolean; unitPrice: number | null; quantity: number; basePrice: number | null; incrementPct: number | null }>;
  fieldServiceHours: number | null;
  fieldServiceUnitPrice: number | null;
};

export async function createFieldServiceCaseFromQuote(quote: FrozenQuote, authorUserId: string) {
  const existing = await prisma.fieldServiceCase.findUnique({ where: { quoteId: quote.id } });
  if (existing) return existing;

  const authorizedLine = quote.lines.find((line) => line.authorized && line.unitPrice != null)
    ?? quote.lines.find((line) => line.unitPrice != null);
  const description = authorizedLine?.concept?.trim() || "Servicio de campo autorizado";
  const hours = quote.fieldServiceHours ?? FIELD_SERVICE_DEFAULT_HOURS;
  let unitPrice = quote.fieldServiceUnitPrice;
  if (unitPrice == null && authorizedLine?.unitPrice != null) {
    unitPrice = authorizedLine.unitPrice;
  }
  if (unitPrice == null) throw new Error("Falta el precio unitario del servicio de campo.");

  const folio = await allocateFolio(quote.companyId, "SCA");
  const row = await prisma.fieldServiceCase.create({
    data: {
      folio,
      companyId: quote.companyId,
      clientId: quote.clientId,
      quoteId: quote.id,
      concept: FIELD_SERVICE_CONCEPT,
      description,
      hours,
      unitPrice,
      sellerUserId: quote.sellerUserId,
    },
  });
  await recordHistory({
    companyId: quote.companyId,
    entityType: "SERVICIO_CAMPO",
    entityId: row.id,
    action: "ALTA",
    summary: `${folio} abierto desde cotización autorizada. Total estimado: ${fieldServiceTotal(hours, unitPrice).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.`,
    authorUserId,
  });
  return row;
}

/** CEO asigna horas y precio unitario en cotización COTSC. */
export function parseFieldServicePricing(
  quoteType: string,
  hoursRaw: unknown,
  linePrices: Array<{ unitPrice: number | null }>,
): { hours: number; unitPrice: number } | null {
  if (quoteType !== "CAMPO") return null;
  const hours = hoursRaw != null && String(hoursRaw).trim() !== "" ? Number(hoursRaw) : FIELD_SERVICE_DEFAULT_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("Indica las horas del servicio de campo (mayor a 0).");
  const unitPrice = linePrices.find((line) => line.unitPrice != null)?.unitPrice;
  if (unitPrice == null || !Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("Indica el precio unitario del servicio de campo.");
  }
  return { hours, unitPrice };
}

export function campoQuoteLineUnitPrice(amount: number) {
  return amount;
}

export function syncCampoLineTotalFromPricing(
  lines: Array<{ unitPrice: number | null; quantity: number; basePrice: number | null; incrementPct: number | null }>,
  hours: number,
  unitPrice: number,
) {
  const total = fieldServiceTotal(hours, unitPrice);
  return lines.map((line) => ({
    ...line,
    unitPrice: total,
    quantity: 1,
    basePrice: null,
    incrementPct: null,
  }));
}

export function quoteCampoDisplayTotal(quote: {
  quoteType: string;
  fieldServiceHours: number | null;
  fieldServiceUnitPrice: number | null;
  lines: Array<{ unitPrice: number | null }>;
}) {
  if (quote.quoteType !== "CAMPO") return null;
  const hours = quote.fieldServiceHours ?? FIELD_SERVICE_DEFAULT_HOURS;
  const unit = quote.fieldServiceUnitPrice ?? quote.lines.find((l) => l.unitPrice != null)?.unitPrice;
  if (unit == null) return null;
  return fieldServiceTotal(hours, unit);
}
