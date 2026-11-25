import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const FALLBACK_CLIENT = { id: "", name: "Cliente", isSystem: false, ownerUserId: null as string | null };

export type PanelDecisionQuote = {
  id: string;
  folio: string;
  quoteType: string;
  status: string;
  discountPct: number;
  sellerUserId: string | null;
  technicalCaseId: string | null;
  client: { id: string; name: string; isSystem: boolean; ownerUserId: string | null };
  equipment: {
    id: string;
    kind: string;
    folio: string;
    custody: string;
    typeName: string | null;
    brandName: string | null;
    model: string;
    client: { id: string; name: string; isSystem: boolean };
  } | null;
  lines: Array<{ quantity: number; unitPrice: number | null; authorized: boolean }>;
};

/**
 * Cotizaciones de panel sin `include` del cliente. Un cliente borrado hace que
 * Prisma aborte el SSR con "Field client is required to return data, got null".
 */
export async function loadPanelDecisionQuotes(where: Prisma.QuoteWhereInput): Promise<PanelDecisionQuote[]> {
  const quotes = await prisma.quote.findMany({
    where,
    select: {
      id: true,
      folio: true,
      quoteType: true,
      status: true,
      discountPct: true,
      sellerUserId: true,
      technicalCaseId: true,
      clientId: true,
      equipment: {
        select: {
          id: true,
          kind: true,
          folio: true,
          custody: true,
          typeName: true,
          brandName: true,
          model: true,
          clientId: true,
        },
      },
      lines: { select: { quantity: true, unitPrice: true, authorized: true } },
    },
    take: 100,
  });
  const ids = [
    ...new Set(quotes.flatMap((quote) => [quote.clientId, quote.equipment?.clientId].filter((id): id is string => Boolean(id)))),
  ];
  const clients = ids.length === 0
    ? []
    : await prisma.client.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, isSystem: true, ownerUserId: true },
      });
  const byId = new Map(clients.map((row) => [row.id, row]));
  return quotes.map((quote) => {
    const client = byId.get(quote.clientId) ?? FALLBACK_CLIENT;
    const equipmentClient = quote.equipment ? byId.get(quote.equipment.clientId) ?? null : null;
    return {
      id: quote.id,
      folio: quote.folio,
      quoteType: quote.quoteType,
      status: quote.status,
      discountPct: quote.discountPct,
      sellerUserId: quote.sellerUserId,
      technicalCaseId: quote.technicalCaseId,
      client,
      equipment: quote.equipment
        ? {
            id: quote.equipment.id,
            kind: quote.equipment.kind,
            folio: quote.equipment.folio,
            custody: quote.equipment.custody,
            typeName: quote.equipment.typeName,
            brandName: quote.equipment.brandName,
            model: quote.equipment.model,
            client: equipmentClient ?? { id: client.id, name: client.name, isSystem: client.isSystem },
          }
        : null,
      lines: quote.lines,
    };
  });
}
