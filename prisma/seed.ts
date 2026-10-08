import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { catalogKey } from "../src/lib/catalog-key";
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

  for (const companyId of [systron.id, servomotores.id]) {
    for (const account of [
      { suffix: "caja", name: "Caja", kind: "EFECTIVO" },
      { suffix: "banco", name: "Banco", kind: "BANCO" },
      { suffix: "tarjeta", name: "Tarjeta", kind: "TARJETA" },
    ]) {
      await prisma.financeAccount.upsert({
        where: { companyId_name: { companyId, name: account.name } },
        update: {},
        create: { id: `account-${account.suffix}-${companyId}`, companyId, name: account.name, kind: account.kind, balance: account.kind === "BANCO" ? 50000 : 0 },
      });
    }
  }

  await ensureSuperAdmin();
  await ensureVerificationUsers(systron.id, servomotores.id);
  await seedPriorities(systron.id, "SYSTRON");
  await seedPriorities(servomotores.id, "SERVOMOTORES");
  await seedCommercialCatalogs(systron.id, servomotores.id);
  await seedEquipmentCatalog();
  await ensureInventarioOct26();
}

async function ensureInventarioOct26() {
  const systron = await prisma.company.findUnique({ where: { code: "SYSTRON" } });
  if (!systron?.inventoryEnabled) return;
  const count = await prisma.part.count({ where: { companyId: systron.id } });
  const withCatalogLine = await prisma.part.count({
    where: { companyId: systron.id, catalogLine: { gt: 0 } },
  });
  if (count === 2277 && withCatalogLine === 2277) return;
  const { importInventarioOct26 } = await import("../scripts/import-inventario-oct26.mts");
  const result = await importInventarioOct26(prisma, { replace: count > 0 });
  process.stdout.write(`Inventario Oct26: ${JSON.stringify(result)}\n`);
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

async function seedEquipmentCatalog() {
  const rows = JSON.parse(readFileSync(new URL("../src/data/equipo-catalogo.json", import.meta.url), "utf8")) as Array<{ type: string; brand: string; model: string }>;
  const types = new Map<string, string>();
  const brands = new Map<string, string>();
  for (const row of rows) {
    const typeKey = catalogKey(row.type);
    const brandKey = catalogKey(row.brand);
    const modelKey = catalogKey(row.model);
    let typeId = types.get(typeKey);
    if (!typeId) {
      const type = await prisma.catalogType.upsert({ where: { key: typeKey }, update: {}, create: { name: row.type, key: typeKey } });
      typeId = type.id;
      types.set(typeKey, typeId);
    }
    let brandId = brands.get(brandKey);
    if (!brandId) {
      const brand = await prisma.catalogBrand.upsert({ where: { key: brandKey }, update: {}, create: { name: row.brand, key: brandKey } });
      brandId = brand.id;
      brands.set(brandKey, brandId);
    }
    await prisma.catalogModel.upsert({
      where: { typeId_brandId_key: { typeId, brandId, key: modelKey } },
      update: {},
      create: { typeId, brandId, name: row.model, key: modelKey },
    });
  }
}

async function seedCommercialCatalogs(systronId: string, servomotoresId: string) {
  for (const companyId of [systronId, servomotoresId]) {
    for (const name of ["Visita", "Llamada", "Seguimiento"]) {
      await prisma.agendaCategory.upsert({
        where: { companyId_name: { companyId, name } },
        update: {},
        create: { companyId, name, countsForGoals: name === "Visita" },
      });
    }
  }
  await prisma.goalType.upsert({
    where: { companyId_name: { companyId: systronId, name: "Clientes nuevos" } },
    update: { active: true },
    create: { companyId: systronId, name: "Clientes nuevos" },
  });
}

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
