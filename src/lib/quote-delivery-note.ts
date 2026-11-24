export function quoteRequiresDeliveryDays(quote: { quoteType: string; technicalCaseId: string | null }) {
  return quote.quoteType === "REPARACION"
    || (quote.quoteType === "DIAGNOSTICO" && quote.technicalCaseId != null);
}

export function quoteShowsSellerDeliveryDays(quote: { quoteType: string; deliveryBusinessDays: number | null }) {
  return quote.quoteType === "VENTA_EQUIPO" && quote.deliveryBusinessDays != null && quote.deliveryBusinessDays >= 1;
}

export function quoteDeliveryEmailNote(quote: {
  quoteType: string;
  technicalCaseId: string | null;
  slaDueAt: Date | null;
  deliveryBusinessDays: number | null;
}): string {
  if (quoteShowsSellerDeliveryDays(quote) && quote.deliveryBusinessDays) {
    return ` Tiempo de entrega: ${quote.deliveryBusinessDays} días hábiles.`;
  }
  if (!quoteRequiresDeliveryDays(quote)) return "";
  if (quote.slaDueAt) {
    return ` Fecha de entrega: ${quote.slaDueAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" })}.`;
  }
  if (quote.deliveryBusinessDays) {
    return ` Tiempo de entrega: ${quote.deliveryBusinessDays} días hábiles.`;
  }
  return "";
}