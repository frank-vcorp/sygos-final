/**
 * Borra datos operativos/comerciales/financieros y conserva catálogos, usuarios,
 * inventario (Part + StockMovement), clientes/proveedores intercompañía y configuración.
 *
 * Uso:
 *   tsx scripts/purge-operational-data.mts --dry-run
 *   SYGOS_PURGE_CONFIRM=1 tsx scripts/purge-operational-data.mts --execute
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TABLES_TO_WIPE = [
  "paymentApplication",
  "collectionNote",
  "payment",
  "billingLine",
  "receivable",
  "payable",
  "billingDocument",
  "saleLine",
  "sale",
  "quoteLine",
  "quote",
  "commissionLine",
  "commissionRun",
  "payrollAdjustment",
  "payrollLine",
  "overtimeRequest",
  "payrollPeriod",
  "vacationPrima",
  "vacationRequest",
  "attendanceDay",
  "laborDocument",
  "collaborator",
  "prospectActivity",
  "prospect",
  "agendaActivity",
  "salesGoal",
  "partPresolicitud",
  "partRequest",
  "technicalLog",
  "technicalCase",
  "custodyMovement",
  "attention",
  "equipment",
  "purchase",
  "financeMovement",
  "functionalHistory",
] as const;

async function counts() {
  const out: Record<string, number> = {};
  for (const key of TABLES_TO_WIPE) {
    out[key] = await (prisma[key] as { count: () => Promise<number> }).count();
  }
  out.clientNonSystem = await prisma.client.count({ where: { isSystem: false } });
  out.clientSystem = await prisma.client.count({ where: { isSystem: true } });
  out.supplierNonSystem = await prisma.supplier.count({ where: { isSystem: false } });
  out.supplierSystem = await prisma.supplier.count({ where: { isSystem: true } });
  out.user = await prisma.user.count();
  out.part = await prisma.part.count();
  out.stockMovement = await prisma.stockMovement.count();
  out.catalogModel = await prisma.catalogModel.count();
  return out;
}

async function execute() {
  await prisma.$transaction(
    async (tx) => {
      await tx.paymentApplication.deleteMany();
      await tx.collectionNote.deleteMany();
      await tx.payment.deleteMany();
      await tx.billingLine.deleteMany();
      await tx.receivable.deleteMany();
      await tx.payable.deleteMany();
      await tx.billingDocument.deleteMany();
      await tx.saleLine.deleteMany();
      await tx.sale.deleteMany();
      await tx.quoteLine.deleteMany();
      await tx.quote.deleteMany();
      await tx.commissionLine.deleteMany();
      await tx.commissionRun.deleteMany();
      await tx.payrollAdjustment.deleteMany();
      await tx.payrollLine.deleteMany();
      await tx.overtimeRequest.deleteMany();
      await tx.payrollPeriod.deleteMany();
      await tx.vacationPrima.deleteMany();
      await tx.vacationRequest.deleteMany();
      await tx.attendanceDay.deleteMany();
      await tx.laborDocument.deleteMany();
      await tx.collaborator.deleteMany();
      await tx.prospectActivity.deleteMany();
      await tx.prospect.deleteMany();
      await tx.agendaActivity.deleteMany();
      await tx.salesGoal.deleteMany();
      await tx.partPresolicitud.deleteMany();
      await tx.partRequest.deleteMany();
      await tx.technicalLog.deleteMany();
      await tx.technicalCase.deleteMany();
      await tx.custodyMovement.deleteMany();
      await tx.attention.deleteMany();
      await tx.equipment.deleteMany();
      await tx.purchase.deleteMany();
      await tx.financeMovement.deleteMany();
      await tx.functionalHistory.deleteMany();
      await tx.contact.deleteMany({
        where: { client: { isSystem: false } },
      });
      await tx.client.deleteMany({ where: { isSystem: false } });
      await tx.supplier.deleteMany({ where: { isSystem: false } });
      await tx.financeAccount.updateMany({ data: { balance: 0 } });
    },
    { timeout: 300_000 },
  );
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const run = process.argv.includes("--execute");
  if (!dryRun && !run) {
    console.error("Indica --dry-run o --execute");
    process.exit(1);
  }
  if (run && process.env.SYGOS_PURGE_CONFIRM !== "1") {
    console.error("Para ejecutar: SYGOS_PURGE_CONFIRM=1 tsx scripts/purge-operational-data.mts --execute");
    process.exit(1);
  }

  const before = await counts();
  console.log(JSON.stringify({ phase: dryRun ? "dry-run" : "execute", before }, null, 2));

  if (dryRun) return;

  await execute();
  const after = await counts();
  console.log(JSON.stringify({ phase: "done", after }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
