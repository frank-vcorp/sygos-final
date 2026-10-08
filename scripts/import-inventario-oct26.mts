import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as PrismaClientCtor } from "@prisma/client";

export const INVENTARIO_OCT26_LINES = 2277;

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

export async function importInventarioOct26(
  prisma: PrismaClient,
  options: { replace?: boolean } = {},
): Promise<{ created: number; expected: number; totalQty: number; skipped: boolean }> {
  const replace = options.replace ?? false;
  const company = await prisma.company.findUnique({ where: { code: "SYSTRON" } });
  if (!company?.inventoryEnabled) throw new Error("SYSTRON sin inventario habilitado.");
  const author =
    (await prisma.user.findFirst({ where: { username: "Almacen" } })) ??
    (await prisma.user.findFirst({ where: { username: "Systronia" } }));
  if (!author) throw new Error("Sin usuario de almacén.");

  const existing = await prisma.part.count({ where: { companyId: company.id } });
  const withCatalogLine = await prisma.part.count({
    where: { companyId: company.id, catalogLine: { gt: 0 } },
  });
  if (!replace && existing === INVENTARIO_OCT26_LINES && withCatalogLine === INVENTARIO_OCT26_LINES) {
    return { created: existing, expected: INVENTARIO_OCT26_LINES, totalQty: 0, skipped: true };
  }
  if (existing > 0 && replace) {
    await prisma.stockMovement.deleteMany({ where: { companyId: company.id } });
    await prisma.part.deleteMany({ where: { companyId: company.id } });
  } else if (existing > 0 && !replace) {
    return { created: existing, expected: INVENTARIO_OCT26_LINES, totalQty: 0, skipped: true };
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
  return { created, expected: rows.length, totalQty, skipped: false };
}

async function main() {
  const prisma = new PrismaClientCtor();
  const replace = process.argv.includes("--replace");
  try {
    const result = await importInventarioOct26(prisma, { replace });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes("import-inventario-oct26")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
