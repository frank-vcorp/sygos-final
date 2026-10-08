import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

type Row = {
  catalogLine: number;
  partNumber: string;
  description: string;
  catalogNumero: string;
  family: string;
  location: string;
  unit: string;
  mountType: string;
  minQty: number | null;
  qty: number;
};

const prisma = new PrismaClient();
const replace = process.argv.includes("--replace");

async function main() {
  const company = await prisma.company.findUnique({ where: { code: "SYSTRON" } });
  if (!company?.inventoryEnabled) throw new Error("SYSTRON sin inventario habilitado.");
  const author =
    (await prisma.user.findFirst({ where: { username: "Almacen" } })) ??
    (await prisma.user.findFirst({ where: { username: "Systronia" } }));
  if (!author) throw new Error("Sin usuario de almacén.");

  const existing = await prisma.part.count({ where: { companyId: company.id } });
  if (existing > 0 && !replace) {
    console.log(`SYSTRON ya tiene ${existing} líneas. Usa --replace para borrar y volver a cargar.`);
    return;
  }
  if (replace && existing > 0) {
    await prisma.stockMovement.deleteMany({ where: { companyId: company.id } });
    await prisma.part.deleteMany({ where: { companyId: company.id } });
  }

  const path = join(process.cwd(), "prisma/data/inventario-oct26.json");
  const rows = JSON.parse(readFileSync(path, "utf8")) as Row[];
  let created = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const slice = rows.slice(i, i + 50);
    await prisma.$transaction(async (tx) => {
      for (const row of slice) {
        const qty = Number.isInteger(row.qty) && row.qty >= 0 ? row.qty : 0;
        const part = await tx.part.create({
          data: {
            companyId: company.id,
            catalogLine: row.catalogLine,
            partNumber: row.partNumber,
            description: row.description ?? "",
            catalogNumero: row.catalogNumero ?? "",
            family: row.family ?? "",
            location: row.location ?? "",
            unit: row.unit ?? "",
            mountType: row.mountType ?? "",
            minQty: row.minQty != null && row.minQty >= 0 ? row.minQty : null,
            qty,
          },
        });
        created += 1;
        if (qty > 0) {
          await tx.stockMovement.create({
            data: {
              companyId: company.id,
              partId: part.id,
              kind: "ENTRADA",
              quantity: qty,
              qtyAfter: qty,
              note: "Carga Inventario_Oct26.xlsx",
              authorUserId: author.id,
            },
          });
        }
      }
    });
  }
  const totalQty = rows.reduce((sum, row) => sum + (row.qty > 0 ? row.qty : 0), 0);
  console.log(JSON.stringify({ created, expected: rows.length, totalQty }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
