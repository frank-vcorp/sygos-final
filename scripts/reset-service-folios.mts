/**
 * Reinicio de folios y datos del ciclo de servicio en staging (DX, OS, COT, FAC, REM, SRV).
 *
 * Conserva: usuarios, empresas, clientes, proveedores, partes, stock, catálogo y filas de equipo
 * (se resetea custodia a SIN_CUSTODIA / holderCompanyId null para bandeja limpia).
 *
 * NO borra clientes ni equipos (a diferencia de scripts/purge-operational-data.mts).
 *
 * Facturación en staging: se eliminan TODOS los billingDocument y dependientes
 * (paymentApplication, collectionNote, payment, billingLine, receivable, payable)
 * para arrancar FAC limpio junto con cotizaciones de servicio.
 *
 * Uso local:
 *   npm run reset-service-folios -- --dry-run
 *   SYGOS_RESET_SERVICE_FOLIOS=1 npm run reset-service-folios -- --execute
 *
 * Coolify (shell en el contenedor de la app, con DATABASE_URL del servicio):
 *   npx tsx scripts/reset-service-folios.mts --dry-run
 *   SYGOS_RESET_SERVICE_FOLIOS=1 npx tsx scripts/reset-service-folios.mts --execute
 *
 * Si DATABASE_URL parece producción, se muestra advertencia; usar --i-know para ejecutar igual.
 */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RESET_SERIES = ["SRV", "DX", "OS", "COT", "FAC", "REM"] as const;

const FUNCTIONAL_HISTORY_OPS = ["OPERACION", "COTIZACION", "FACTURACION"] as const;

/** Cotizaciones del ciclo de servicio (no ventas CAMPO / VENTA_EQUIPO salvo enlace a caso). */
const serviceQuoteWhere: Prisma.QuoteWhereInput = {
  OR: [
    { quoteType: { in: ["DIAGNOSTICO", "REPARACION"] } },
    { technicalCaseId: { not: null } },
    { folio: { startsWith: "COT-" } },
  ],
};

function looksLikeProductionDatabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (/\bprod(uction)?\b/.test(lower)) return true;
  if (lower.includes("sygos-prod") || lower.includes("production.")) return true;
  return false;
}

async function snapshotCounts() {
  const serviceQuotes = await prisma.quote.count({ where: serviceQuoteWhere });

  return {
    paymentApplication: await prisma.paymentApplication.count(),
    collectionNote: await prisma.collectionNote.count(),
    payment: await prisma.payment.count(),
    billingLine: await prisma.billingLine.count(),
    receivable: await prisma.receivable.count(),
    payable: await prisma.payable.count(),
    billingDocument: await prisma.billingDocument.count(),
    saleLinkedToServiceQuote: await prisma.sale.count({ where: { quote: serviceQuoteWhere } }),
    serviceQuote,
    serviceQuotes,
    quoteLineOnServiceQuotes: await prisma.quoteLine.count({ where: { quote: serviceQuoteWhere } }),
    partPresolicitud: await prisma.partPresolicitud.count(),
    partRequest: await prisma.partRequest.count(),
    technicalLog: await prisma.technicalLog.count(),
    technicalCase: await prisma.technicalCase.count(),
    custodyMovement: await prisma.custodyMovement.count(),
    attention: await prisma.attention.count(),
    equipment: await prisma.equipment.count(),
    equipmentNotSinCustodia: await prisma.equipment.count({
      where: { NOT: { custody: "SIN_CUSTODIA", holderCompanyId: null } },
    }),
    functionalHistoryOps: await prisma.functionalHistory.count({
      where: { entityType: { in: [...FUNCTIONAL_HISTORY_OPS] } },
    }),
    folioSequenceReset: await prisma.folioSequence.count({
      where: { series: { in: [...RESET_SERIES] } },
    }),
    kept: {
      user: await prisma.user.count(),
      client: await prisma.client.count(),
      part: await prisma.part.count(),
      stockMovement: await prisma.stockMovement.count(),
      quoteNonService: await prisma.quote.count({ where: { NOT: serviceQuoteWhere } }),
    },
  };
}

async function executeReset() {
  await prisma.$transaction(
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
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const run = process.argv.includes("--execute");
  const iKnow = process.argv.includes("--i-know");

  if (!dryRun && !run) {
    console.error("Indica --dry-run o --execute");
    process.exit(1);
  }

  if (run && process.env.SYGOS_RESET_SERVICE_FOLIOS !== "1") {
    console.error(
      "Para ejecutar: SYGOS_RESET_SERVICE_FOLIOS=1 tsx scripts/reset-service-folios.mts --execute",
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (looksLikeProductionDatabaseUrl(dbUrl)) {
    console.warn(
      "ADVERTENCIA: DATABASE_URL parece apuntar a producción. Revisa antes de continuar.",
    );
    if (run && !iKnow) {
      console.error("Ejecución abortada. Usa --i-know si estás seguro.");
      process.exit(1);
    }
  }

  const before = await snapshotCounts();
  console.log(JSON.stringify({ phase: dryRun ? "dry-run" : "execute", before }, null, 2));

  if (dryRun) return;

  await executeReset();
  const after = await snapshotCounts();
  console.log(JSON.stringify({ phase: "done", after }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
