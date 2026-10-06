import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { bindSandbox, prismaProd, sandboxFor } from "./db";
import { hashToken, newSessionToken, verifyPassword } from "./crypto";
import { SESSION_COOKIE } from "./session-cookie";
import { isRole, type Role } from "./roles";
import { needsExplicitCompany } from "./permissions";

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
  realUserId: string;
  realRole: Role;
  impersonating: boolean;
};

export async function startSession(username: string, password: string): Promise<AppSession | null> {
  const user = await prismaProd.user.findUnique({
    where: { username },
    include: { company: true },
  });
  if (!user || !user.active) return null;
  if (!isRole(user.role)) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const { token, tokenHash } = newSessionToken();
  const activeCompanyId = needsExplicitCompany(user.role) ? null : user.companyId;
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prismaProd.session.create({
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
  const row = await prismaProd.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { include: { company: true } },
      impersonatedUser: { include: { company: true } },
    },
  });
  if (!row || row.expiresAt.getTime() < Date.now() || !row.user.active) return null;
  if (!isRole(row.user.role)) return null;

  const impersonated = row.user.role === "ADMINISTRADOR" && row.impersonatedUser?.active && isRole(row.impersonatedUser.role) && row.impersonatedUser.role !== "ADMINISTRADOR"
    ? row.impersonatedUser
    : null;
  const actor = impersonated ?? row.user;
  if (!isRole(actor.role)) return null;

  let activeCompanyCode: string | null = null;
  let activeCompanyName: string | null = null;
  if (row.activeCompanyId) {
    const company = await prismaProd.company.findUnique({ where: { id: row.activeCompanyId } });
    activeCompanyCode = company?.code ?? null;
    activeCompanyName = company?.name ?? null;
  }

  bindSandbox(sandboxFor(actor.id, actor.role));

  return {
    sessionId: row.id,
    userId: actor.id,
    username: actor.username,
    name: actor.name,
    role: actor.role,
    homeCompanyId: actor.companyId,
    homeCompanyCode: actor.company?.code ?? null,
    activeCompanyId: row.activeCompanyId,
    activeCompanyCode,
    activeCompanyName,
    realUserId: row.user.id,
    realRole: row.user.role,
    impersonating: Boolean(impersonated),
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
    await prismaProd.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function setActiveCompany(sessionId: string, companyId: string) {
  await prismaProd.session.update({
    where: { id: sessionId },
    data: { activeCompanyId: companyId },
  });
}
