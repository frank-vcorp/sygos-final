import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { resolve } from "path";
import { cookies } from "next/headers";
import { hashToken } from "./crypto";
import { SESSION_COOKIE } from "./session-cookie";

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
  return isParticipant(readSandbox(), userId, role);
}

export const prismaProd =
  globalForPrisma.prismaProd ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaProd = prismaProd;

function testClient() {
  if (!globalForPrisma.prismaTest) {
    globalForPrisma.prismaTest = new PrismaClient({ datasourceUrl: `file:${sandboxDatabasePath()}` });
  }
  return globalForPrisma.prismaTest;
}

const cache = new Map<string, { at: number; yes: boolean }>();

export async function inSandbox() {
  const meta = readSandbox();
  if (!meta.active) return false;
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const marked = (await cookies()).get("sygos_sandbox")?.value === "1";
    if (!token) return false;
    if (marked) return true;
    const tokenHash = hashToken(token);
    const hit = cache.get(tokenHash);
    if (hit && Date.now() - hit.at < 3000) return hit.yes;
    const row = await prismaProd.session.findUnique({
      where: { tokenHash },
      include: { user: true, impersonatedUser: true },
    });
    const actor = row?.user.role === "ADMINISTRADOR" && row.impersonatedUser?.active ? row.impersonatedUser : row?.user;
    const yes = Boolean(actor && sandboxFor(actor.id, actor.role));
    cache.set(tokenHash, { at: Date.now(), yes });
    return yes;
  } catch {
    return false;
  }
}

export async function activateSandbox(userIds: string[], roles: string[]) {
  const current = readSandbox();
  if (current.active) throw new Error("Ya hay un modo de pruebas activo. Hay que finalizarlo antes de abrir otro.");
  if (userIds.length === 0 && roles.length === 0) throw new Error("Selecciona usuarios o roles.");
  const target = sandboxDatabasePath();
  if (existsSync(target)) unlinkSync(target);
  await prismaProd.$executeRawUnsafe(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  if (globalForPrisma.prismaTest) {
    await globalForPrisma.prismaTest.$disconnect();
    globalForPrisma.prismaTest = null;
  }
  const meta: SandboxMeta = { active: true, userIds, roles };
  writeFileSync(metaPath(), JSON.stringify(meta));
  cache.clear();
}

export async function finishSandbox() {
  if (globalForPrisma.prismaTest) {
    await globalForPrisma.prismaTest.$disconnect();
    globalForPrisma.prismaTest = null;
  }
  writeFileSync(metaPath(), JSON.stringify({ active: false, userIds: [], roles: [] }));
  const target = sandboxDatabasePath();
  if (existsSync(target)) unlinkSync(target);
  cache.clear();
}

function wrapDelegate(prop: PropertyKey, delegate: object) {
  return new Proxy(delegate, {
    get(target, op) {
      const fn = (target as Record<PropertyKey, unknown>)[op];
      if (typeof fn !== "function") return fn;
      return async (...args: unknown[]) => {
        if (await inSandbox()) {
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
    if (prop === "$transaction") {
      return async (...args: unknown[]) => {
        const client = (await inSandbox() ? testClient() : target) as unknown as { $transaction: (...a: unknown[]) => unknown };
        return client.$transaction(...args);
      };
    }
    const value = (target as unknown as Record<PropertyKey, unknown>)[prop];
    if (typeof value === "object" && value !== null) return wrapDelegate(prop, value);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  },
}) as PrismaClient;
