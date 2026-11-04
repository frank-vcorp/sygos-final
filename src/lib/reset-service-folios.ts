import { Prisma, type PrismaClient } from "@prisma/client";
import { prismaProd } from "./db";

const RESET_SERIES = ["SRV", "DX", "OS", "COT", "FAC", "REM"] as const;

const FUNCTIONAL_HISTORY_OPS = ["OPERACION", "COTIZACION", "FACTURACION"] as const;

/** Cotizaciones del ciclo de servicio (no ventas CAMPO / VENTA_EQUIPO salvo enlace a caso). */
export const serviceQuoteWhere: Prisma.QuoteWhereInput = {
  OR: [
    { quoteType: { in: ["DIAGNOSTICO", "REPARACION"] } },
    { technicalCaseId: { not: null } },
    { folio: { startsWith: "COT-" } },
  ],
};

export function looksLikeProductionDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (/\bprod(uction)?\b/.test(lower)) return true;
  if (lower.includes("sygos-prod") || lower.includes("production.")) return true;
  return false;
}

export async function snapshotServiceFolioResetCounts(client: PrismaClient = prismaProd) {
  const serviceQuotes = await client.quote.count({ where: serviceQuoteWhere });

  return {
    paymentApplication: await client.paymentApplication.count(),
    collectionNote: await client.collectionNote.count(),
    payment: await client.payment.count(),
    billingLine: await client.billingLine.count(),
    receivable: await client.receivable.count(),
    payable: await client.payable.count(),
    billingDocument: await client.billingDocument.count(),
    saleLinkedToServiceQuote: await client.sale.count({ where: { quote: serviceQuoteWhere } }),
    serviceQuotes,
    quoteLineOnServiceQuotes: await client.quoteLine.count({ where: { quote: serviceQuoteWhere } }),
    partPresolicitud: await client.partPresolicitud.count(),
    partRequest: await client.partRequest.count(),
    technicalLog: await client.technicalLog.count(),
    technicalCase: await client.technicalCase.count(),
    custodyMovement: await client.custodyMovement.count(),
    attention: await client.attention.count(),
    equipment: await client.equipment.count(),
    equipmentNotSinCustodia: await client.equipment.count({
      where: { NOT: { custody: "SIN_CUSTODIA", holderCompanyId: null } },
    }),
    functionalHistoryOps: await client.functionalHistory.count({
      where: { entityType: { in: [...FUNCTIONAL_HISTORY_OPS] } },
    }),
    folioSequenceReset: await client.folioSequence.count({
      where: { series: { in: [...RESET_SERIES] } },
    }),
    kept: {
      user: await client.user.count(),
      client: await client.client.count(),
      part: await client.part.count(),
      stockMovement: await client.stockMovement.count(),
      quoteNonService: await client.quote.count({ where: { NOT: serviceQuoteWhere } }),
    },
  };
}

export type ServiceFolioResetCounts = Awaited<ReturnType<typeof snapshotServiceFolioResetCounts>>;

export class ServiceFolioResetBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceFolioResetBlockedError";
  }
}

function assertMayExecuteReset(databaseUrl: string | undefined, allowProduction: boolean) {
  if (looksLikeProductionDatabaseUrl(databaseUrl) && !allowProduction) {
    throw new ServiceFolioResetBlockedError(
      "DATABASE_URL parece apuntar a producción. El reinicio desde la interfaz está bloqueado.",
    );
  }
}

export async function executeServiceFolioReset(options?: {
  allowProduction?: boolean;
  databaseUrl?: string;
  client?: PrismaClient;
}) {
  const allowProduction = options?.allowProduction ?? false;
  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL;
  const client = options?.client ?? prismaProd;

  assertMayExecuteReset(databaseUrl, allowProduction);

  await client.$transaction(
    async (tx) => {
      await tx.paymentApplication.deleteMany();
      await tx.collectionNote.deleteMany();
      await tx.payment.deleteMany();
      await tx.billingLine.deleteMany();
      await tx.receivable.deleteMany();
      await tx.payable.deleteMany();
      await tx.billingDocument.deleteMany();

      await tx.sale.deleteMany({ where: { quote: serviceQuoteWhere } });
      await tx.quote.deleteMany({ where: serviceQuoteWhere });

      await tx.partPresolicitud.deleteMany();
      await tx.partRequest.deleteMany();
      await tx.technicalLog.deleteMany();
      await tx.technicalCase.deleteMany();

      await tx.custodyMovement.deleteMany();
      await tx.attention.deleteMany();

      await tx.equipment.updateMany({
        data: { custody: "SIN_CUSTODIA", holderCompanyId: null },
      });

      await tx.functionalHistory.deleteMany({
        where: { entityType: { in: [...FUNCTIONAL_HISTORY_OPS] } },
      });

      await tx.folioSequence.deleteMany({
        where: { series: { in: [...RESET_SERIES] } },
      });
    },
    { timeout: 300_000 },
  );

  return snapshotServiceFolioResetCounts(client);
}
