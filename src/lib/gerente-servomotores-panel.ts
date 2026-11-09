import type { ServicioBandejaRow } from "@/lib/servicios-supervisor";
import {
  servicioCotizadaSinAutorizacion,
  servicioDxSinReparacionPendienteEmitir,
  servicioOsValidadaAutorizada,
  servicioOsValidadaPendienteEntrega,
  servicioPendienteAutorizacion,
  servicioRowFromPendingQuote,
} from "@/lib/sales-panel";

export function mergeGerenteServomotoresPendientesAutorizacion(
  servicioRows: ServicioBandejaRow[],
  orphanQuoteRows: ServicioBandejaRow[],
) {
  const seen = new Set<string>();
  const merged: ServicioBandejaRow[] = [];
  for (const row of [...servicioRows, ...orphanQuoteRows]) {
    if (!servicioPendienteAutorizacion(row)) continue;
    const key = row.quoteHref ?? row.id;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

export {
  servicioCotizadaSinAutorizacion,
  servicioDxSinReparacionPendienteEmitir,
  servicioOsValidadaAutorizada,
  servicioOsValidadaPendienteEntrega,
  servicioRowFromPendingQuote,
};
