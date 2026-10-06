import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { cookies } from "next/headers";
import { resolve } from "path";
import { hashToken } from "./crypto";
import { SESSION_COOKIE } from "./session-cookie";

const sandboxContext = new AsyncLocalStorage<boolean>();

const globalForPrisma = globalThis as unknown as { prismaProd?: PrismaClient; prismaTest?: PrismaClient | null };

export function productionDatabasePath() {
  const raw = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "").replace(/^"/, "").replace(/"$/, "");
  if (raw.startsWith("/")) return raw;
  return resolve(process.cwd(), "prisma", raw.replace(/^\.\//, ""));
}

export function sandboxDatabasePath() {
  return productionDatabasePath().replace(/\.db$/, "") + "-sandbox.db";
}

function metaPath() {
  return productionDatabasePath().replace(/\.db$/, "") + "-sandbox.json";
}

export type SandboxMeta = { active: boolean; userIds: string[]; roles: string[] };

export function readSandbox(): SandboxMeta {
  try {
    const parsed = JSON.parse(readFileSync(metaPath(), "utf8")) as SandboxMeta;
    return { active: Boolean(parsed.active), userIds: parsed.userIds ?? [], roles: parsed.roles ?? [] };
  } catch {
    return { active: false, userIds: [], roles: [] };
  }
}

export function isParticipant(meta: SandboxMeta, userId: string, role: string) {
  return meta.active && (meta.userIds.includes(userId) || meta.roles.includes(role));
}

export function sandboxFor(userId: string, role: string) {
  return isParticipant(readSandbox(), userId, role) && existsSync(sandboxDatabasePath());
}

export function bindSandbox(active: boolean) {
  sandboxContext.enterWith(active);
}

export function sandboxBound() {
  return sandboxContext.getStore() === true;
}

export async function inSandbox() {
  if (sandboxBound()) return true;
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return false;
    const row = await prismaProd.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true, impersonatedUser: true },
    });
    if (!row || row.expiresAt.getTime() < Date.now() || !row.user.active) return false;
    const impersonated =
      row.user.role === "ADMINISTRADOR" && row.impersonatedUser?.active && row.impersonatedUser.role !== "ADMINISTRADOR"
        ? row.impersonatedUser
        : null;
    const actor = impersonated ?? row.user;
    return sandboxFor(actor.id, actor.role);
  } catch {
    return false;
  }
}

export const prismaProd =
  globalForPrisma.prismaProd ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaProd = prismaProd;

function testClient() {
  if (!existsSync(sandboxDatabasePath())) throw new Error("La copia de pruebas no está disponible.");
  if (!globalForPrisma.prismaTest) {
    globalForPrisma.prismaTest = new PrismaClient({ datasourceUrl: `file:${sandboxDatabasePath()}` });
  }
  return globalForPrisma.prismaTest;
}

export async function activateSandbox(userIds: string[], roles: string[]) {
  const current = readSandbox();
  if (current.active) throw new Error("Ya hay un modo de pruebas activo. Hay que finalizarlo antes de abrir otro.");
  if (userIds.length === 0 && roles.length === 0) throw new Error("Selecciona usuarios o roles.");
  const target = sandboxDatabasePath();
  if (target === productionDatabasePath()) throw new Error("La copia de pruebas no puede ser la base real.");
  if (existsSync(target)) unlinkSync(target);
  await prismaProd.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
  await prismaProd.$executeRawUnsafe(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  if (!existsSync(target)) throw new Error("No se pudo crear la copia de pruebas.");
  if (globalForPrisma.prismaTest) {
    await globalForPrisma.prismaTest.$disconnect();
    globalForPrisma.prismaTest = null;
  }
  writeFileSync(metaPath(), JSON.stringify({ active: true, userIds, roles } satisfies SandboxMeta));
}

export async function finishSandbox() {
  if (globalForPrisma.prismaTest) {
    await globalForPrisma.prismaTest.$disconnect();
    globalForPrisma.prismaTest = null;
  }
  writeFileSync(metaPath(), JSON.stringify({ active: false, userIds: [], roles: [] }));
  const target = sandboxDatabasePath();
  if (existsSync(target)) unlinkSync(target);
  bindSandbox(false);
}

const ALWAYS_PROD = new Set(["session"]);

async function useTest(model: PropertyKey) {
  return (await inSandbox()) && !ALWAYS_PROD.has(String(model));
}

function wrapDelegate(prop: PropertyKey, delegate: object) {
  return new Proxy(delegate, {
    get(target, op) {
      const fn = (target as Record<PropertyKey, unknown>)[op];
      if (typeof fn !== "function") return fn;
      return async (...args: unknown[]) => {
        if (await useTest(prop)) {
          const model = (testClient() as unknown as Record<PropertyKey, Record<PropertyKey, (...a: unknown[]) => unknown>>)[prop];
          return model[op](...args);
        }
        return (fn as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}

export const prisma = new Proxy(prismaProd, {
  get(target, prop) {
    if (prop === "$transaction" || prop === "$queryRaw" || prop === "$executeRaw" || prop === "$queryRawUnsafe" || prop === "$executeRawUnsafe") {
      return async (...args: unknown[]) => {
        const client = ((await useTest(prop)) ? testClient() : target) as unknown as Record<PropertyKey, (...a: unknown[]) => unknown>;
        return client[prop](...args);
      };
    }
    const value = (target as unknown as Record<PropertyKey, unknown>)[prop];
    if (typeof value === "object" && value !== null) return wrapDelegate(prop, value);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  },
}) as PrismaClient;
