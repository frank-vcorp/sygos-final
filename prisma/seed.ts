import { mkdirSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/crypto";
import { initialPriorities } from "../src/lib/priorities";
import { DEFAULT_MONTHLY_PURCHASE, DEFAULT_PURCHASE_LIMIT, isPurchaseManager, type Role } from "../src/lib/roles";

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
  await ensureVerificationUsers(systron.id, servomotores.id);
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

const VERIFICATION_USERS: Array<{ username: string; name: string; role: Role; company: "SYSTRON" | "SERVOMOTORES" | null }> = [
  { username: "Ceo", name: "CEO", role: "CEO", company: null },
  { username: "Coordinacion", name: "Coordinación de Administración", role: "COORDINACION_ADMINISTRACION", company: null },
  { username: "GerenteSystron", name: "Gerente Operativo SYSTRON", role: "GERENTE_OPERATIVO_SYSTRON", company: "SYSTRON" },
  { username: "GerenteServomotores", name: "Gerente Operativo Servomotores", role: "GERENTE_OPERATIVO_SERVOMOTORES", company: "SERVOMOTORES" },
  { username: "Supervisor", name: "Supervisor Técnico", role: "SUPERVISOR_TECNICO", company: "SYSTRON" },
  { username: "Tecnico", name: "Técnico", role: "TECNICO", company: "SYSTRON" },
  { username: "Ventas", name: "Ventas", role: "VENTAS", company: "SYSTRON" },
  { username: "Almacen", name: "Almacén", role: "ALMACEN", company: "SYSTRON" },
  { username: "Ayudante", name: "Ayudante General", role: "AYUDANTE_GENERAL", company: "SERVOMOTORES" },
  { username: "Kiosco", name: "Kiosco de Asistencia", role: "KIOSCO_ASISTENCIA", company: "SYSTRON" },
];

async function ensureVerificationUsers(systronId: string, servomotoresId: string) {
  const password = process.env.VERIFICATION_PASSWORD?.trim() || "";
  if (password.length < 10) return;
  const companyOf = (code: "SYSTRON" | "SERVOMOTORES" | null) => (code === "SYSTRON" ? systronId : code === "SERVOMOTORES" ? servomotoresId : null);
  const lines = ["Cuentas de verificación. Úsalas con Ver como.", ""];
  for (const profile of VERIFICATION_USERS) {
    const existing = await prisma.user.findUnique({ where: { username: profile.username } });
    const data = {
      name: profile.name,
      role: profile.role,
      companyId: companyOf(profile.company),
      active: true,
      monthlyPurchaseBudget: isPurchaseManager(profile.role) ? DEFAULT_MONTHLY_PURCHASE : null,
      purchaseLimit: isPurchaseManager(profile.role) ? DEFAULT_PURCHASE_LIMIT : null,
    };
    if (!existing) {
      await prisma.user.create({ data: { username: profile.username, passwordHash: hashPassword(password), ...data } });
    } else if (!verifyPassword(password, existing.passwordHash)) {
      await prisma.user.update({ where: { id: existing.id }, data: { ...data, passwordHash: hashPassword(password) } });
    } else {
      await prisma.user.update({ where: { id: existing.id }, data });
    }
    lines.push(`${profile.username} · ${profile.name} · ${profile.company ?? "elige empresa"}`);
  }
  lines.push("", `contraseña común: ${password}`);
  if (process.env.NODE_ENV !== "production") {
    mkdirSync(".credentials", { recursive: true });
    writeFileSync(".credentials/perfiles.txt", `${lines.join("\n")}\n`, { mode: 0o600 });
    process.stdout.write("Cuentas de verificación listas en .credentials/perfiles.txt\n");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
