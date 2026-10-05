import { mkdirSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";
import { DEFAULT_MONTHLY_PURCHASE, DEFAULT_PURCHASE_LIMIT } from "../src/lib/roles";

const prisma = new PrismaClient();

async function main() {
  const systron = await prisma.company.upsert({
    where: { code: "SYSTRON" },
    update: { name: "SYSTRON" },
    create: { code: "SYSTRON", name: "SYSTRON" },
  });
  const servomotores = await prisma.company.upsert({
    where: { code: "SERVOMOTORES" },
    update: { name: "Servomotores" },
    create: { code: "SERVOMOTORES", name: "Servomotores", inventoryEnabled: false },
  });

  await prisma.client.upsert({
    where: { id: "client-intercompany-systron" },
    update: {},
    create: {
      id: "client-intercompany-systron",
      companyId: servomotores.id,
      name: "SYSTRON",
      isSystem: true,
      requiresInvoice: true,
    },
  });
  await prisma.supplier.upsert({
    where: { id: "supplier-intercompany-servomotores" },
    update: {},
    create: {
      id: "supplier-intercompany-servomotores",
      companyId: systron.id,
      name: "Servomotores",
      isSystem: true,
      issuesInvoice: true,
    },
  });

  const existing = await prisma.user.findUnique({ where: { username: "Vectoria" } });
  if (!existing) {
    const password = process.env.VECTORIA_PASSWORD?.trim() || randomBytes(18).toString("base64url");
    await prisma.user.create({
      data: {
        username: "Vectoria",
        name: "Vectoria",
        passwordHash: hashPassword(password),
        role: "ADMINISTRADOR",
        monthlyPurchaseBudget: DEFAULT_MONTHLY_PURCHASE,
        purchaseLimit: DEFAULT_PURCHASE_LIMIT,
      },
    });
    mkdirSync(".credentials", { recursive: true });
    writeFileSync(".credentials/vectoria.txt", `usuario: Vectoria\ncontraseña: ${password}\n`, { mode: 0o600 });
    process.stdout.write("Credencial inicial escrita en .credentials/vectoria.txt\n");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
