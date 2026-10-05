import { mkdirSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/crypto";
import { initialPriorities } from "../src/lib/priorities";
import { DEFAULT_MONTHLY_PURCHASE, DEFAULT_PURCHASE_LIMIT } from "../src/lib/roles";

const prisma = new PrismaClient();

async function main() {
  const systron = await prisma.company.upsert({
    where: { code: "SYSTRON" },
    update: { name: "SYSTRON", inventoryEnabled: true },
    create: { code: "SYSTRON", name: "SYSTRON", inventoryEnabled: true },
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

  await ensureSuperAdmin();
  await seedPriorities(systron.id, "SYSTRON");
  await seedPriorities(servomotores.id, "SERVOMOTORES");
}

async function seedPriorities(companyId: string, code: "SYSTRON" | "SERVOMOTORES") {
  for (const priority of initialPriorities(code)) {
    await prisma.priority.upsert({
      where: {
        companyId_attentionType_name: {
          companyId,
          attentionType: priority.attentionType,
          name: priority.name,
        },
      },
      update: {},
      create: { companyId, ...priority },
    });
  }
}

const SUPERADMIN_USERNAME = "Systronia";

function writeSuperAdminCredential(password: string) {
  mkdirSync(".credentials", { recursive: true });
  writeFileSync(".credentials/systronia.txt", `usuario: ${SUPERADMIN_USERNAME}\ncontraseña: ${password}\n`, { mode: 0o600 });
  process.stdout.write("Credencial de administrador escrita en .credentials/systronia.txt\n");
}

async function ensureSuperAdmin() {
  const password = process.env.SUPERADMIN_PASSWORD?.trim() || "";
  const adminData = {
    username: SUPERADMIN_USERNAME,
    name: SUPERADMIN_USERNAME,
    role: "ADMINISTRADOR",
    active: true,
    companyId: null,
    monthlyPurchaseBudget: DEFAULT_MONTHLY_PURCHASE,
    purchaseLimit: DEFAULT_PURCHASE_LIMIT,
  };
  const current = await prisma.user.findUnique({ where: { username: SUPERADMIN_USERNAME } });
  const previous = current ? null : await prisma.user.findUnique({ where: { username: "Vectoria" } });
  const target = current ?? previous;

  if (!target) {
    const chosen = password || randomBytes(18).toString("base64url");
    await prisma.user.create({
      data: { ...adminData, passwordHash: hashPassword(chosen) },
    });
    writeSuperAdminCredential(chosen);
    return;
  }

  const passwordChanged = Boolean(password) && !verifyPassword(password, target.passwordHash);
  await prisma.user.update({
    where: { id: target.id },
    data: {
      ...adminData,
      ...(passwordChanged ? { passwordHash: hashPassword(password) } : {}),
    },
  });
  if (password && (passwordChanged || previous)) writeSuperAdminCredential(password);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
