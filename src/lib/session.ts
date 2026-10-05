import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { hashToken, newSessionToken, verifyPassword } from "./crypto";
import { isRole, type Role } from "./roles";
import { needsExplicitCompany } from "./permissions";

export const SESSION_COOKIE = "sygos_session";
const SESSION_DAYS = 14;

export type AppSession = {
  sessionId: string;
  userId: string;
  username: string;
  name: string;
  role: Role;
  homeCompanyId: string | null;
  homeCompanyCode: string | null;
  activeCompanyId: string | null;
  activeCompanyCode: string | null;
  activeCompanyName: string | null;
};

export async function startSession(username: string, password: string): Promise<AppSession | null> {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { company: true },
  });
  if (!user || !user.active) return null;
  if (!isRole(user.role)) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const { token, tokenHash } = newSessionToken();
  const activeCompanyId = needsExplicitCompany(user.role) ? null : user.companyId;
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { userId: user.id, tokenHash, activeCompanyId, expiresAt },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return loadSession(token);
}

export async function getSession(): Promise<AppSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return loadSession(token);
}

async function loadSession(token: string): Promise<AppSession | null> {
  const row = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { company: true } } },
  });
  if (!row || row.expiresAt.getTime() < Date.now() || !row.user.active) return null;
  if (!isRole(row.user.role)) return null;

  let activeCompanyCode: string | null = null;
  let activeCompanyName: string | null = null;
  if (row.activeCompanyId) {
    const company = await prisma.company.findUnique({ where: { id: row.activeCompanyId } });
    activeCompanyCode = company?.code ?? null;
    activeCompanyName = company?.name ?? null;
  }

  return {
    sessionId: row.id,
    userId: row.user.id,
    username: row.user.username,
    name: row.user.name,
    role: row.user.role,
    homeCompanyId: row.user.companyId,
    homeCompanyCode: row.user.company?.code ?? null,
    activeCompanyId: row.activeCompanyId,
    activeCompanyCode,
    activeCompanyName,
  };
}

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireCompany(): Promise<AppSession & { activeCompanyId: string; activeCompanyCode: string; activeCompanyName: string }> {
  const session = await requireSession();
  if (!session.activeCompanyId || !session.activeCompanyCode || !session.activeCompanyName) {
    redirect("/empresa");
  }
  return session as AppSession & {
    activeCompanyId: string;
    activeCompanyCode: string;
    activeCompanyName: string;
  };
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function setActiveCompany(sessionId: string, companyId: string) {
  await prisma.session.update({
    where: { id: sessionId },
    data: { activeCompanyId: companyId },
  });
}
