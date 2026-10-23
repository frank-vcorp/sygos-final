import { PrismaClient } from "@prisma/client";
import { backfillPartSearchKeys } from "../src/lib/inventory-search";

const prisma = new PrismaClient();

async function main() {
  const companyCode = process.argv[2]?.trim();
  const company = companyCode ? await prisma.company.findUnique({ where: { code: companyCode } }) : null;
  if (companyCode && !company) throw new Error(`Empresa ${companyCode} no encontrada.`);
  const result = await backfillPartSearchKeys(prisma, company?.id);
  process.stdout.write(`searchKey: ${result.updated} actualizadas de ${result.scanned} líneas.\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
