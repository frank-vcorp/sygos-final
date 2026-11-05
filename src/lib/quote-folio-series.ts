import type { QuoteType } from "./quote-meta";

export const COMMERCIAL_QUOTE_SERIES = ["COTDX", "COTOS", "COTSC", "COTVT", "SCA"] as const;
export type CommercialQuoteSeries = (typeof COMMERCIAL_QUOTE_SERIES)[number];

export function commercialQuoteSeriesForType(quoteType: QuoteType): CommercialQuoteSeries {
  switch (quoteType) {
    case "DIAGNOSTICO":
      return "COTDX";
    case "REPARACION":
      return "COTOS";
    case "CAMPO":
      return "COTSC";
    case "VENTA_EQUIPO":
      return "COTVT";
  }
}

/** Cotización comercial del vendedor (folio COT* independiente del ciclo SRV). */
export function isSellerCommercialQuote(quote: { technicalCaseId: string | null }) {
  return quote.technicalCaseId == null;
}

export function isCotosQuote(quote: { quoteType: string; folio: string; technicalCaseId: string | null }) {
  return quote.quoteType === "REPARACION" && isSellerCommercialQuote(quote) && quote.folio.startsWith("COTOS-");
}

export function commercialSeriesFromFolio(folio: string): CommercialQuoteSeries | null {
  const match = /^(COTDX|COTOS|COTSC|COTVT|SCA)-/.exec(folio);
  return match ? (match[1] as CommercialQuoteSeries) : null;
}
