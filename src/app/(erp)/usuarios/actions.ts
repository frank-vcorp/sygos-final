import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { setFlash } from "@/lib/flash";
import { ConcurrencyError, optionalText, parseVersion, requiredText } from "@/lib/form";
import { recordHistory } from "@/lib/history";
import { can, canSeeUser } from "@/lib/permissions";
import {
  DEFAULT_MONTHLY_PURCHASE,
  DEFAULT_PURCHASE_LIMIT,
  isPurchaseManager,
  isRole,
  roleFitsCompany,
  type Role,
} from "@/lib/roles";
import { requireSession } from "@/lib/session";

async function guard(admins = false) {
  const session = await requireSession();
  if (!can(session.role, admins ? "user.manageAdmins" : "user.manage")) {
    await setFlash({ tone: "error", message: "No tienes permiso para usuarios." });
    redirect("/inicio");
  }
  return session;
}

export async function createUserAction(formData: FormData) {
  "use server";
  try {
    const session = await guard();
    const roleRaw = requiredText(formData.get("role"), "Rol");
    if (!isRole(roleRaw)) throw new Error("El rol no existe.");
    if (roleRaw === "ADMINISTRADOR" && !can(session.role, "user.manageAdmins")) {
      throw new Error("No puedes crear cuentas de Administrador.");
    }
    const companyCode = optionalText(formData.get("companyCode"));
    if (!roleFitsCompany(roleRaw, companyCode)) throw new Error("Ese rol no corresponde a la empresa elegida.");
    const company = companyCode ? await prisma.company.findUnique({ where: { code: companyCode } }) : null;
    if (companyCode && !company) throw new Error("La empresa no existe.");
    const username = requiredText(formData.get("username"), "Usuario");
    const password = requiredText(formData.get("password"), "Contraseña");
    if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");
    const limits = limitsFrom(roleRaw, formData);
    const user = await prisma.user.create({
      data: {
        username,
        name: requiredText(formData.get("name"), "Nombre"),
        passwordHash: hashPassword(password),
        role: roleRaw,
        companyId: company?.id ?? null,
        ...limits,
      },
    });
    await recordHistory({
      entityType: "USUARIO",
      entityId: user.id,
      action: "ALTA",
      summary: `Usuario ${user.username} creado con rol ${roleRaw}.`,
      authorUserId: session.userId,
    });
    redirect(`/usuarios/${user.id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    const message = error instanceof Error && error.message.includes("Unique constraint")
      ? "Ese usuario ya existe."
      : messageOf(error);
    await setFlash({ tone: "error", message });
    redirect("/usuarios/nuevo");
  }
}

export async function updateUserAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Usuario");
  try {
    const session = await guard();
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || !isRole(target.role) || !canSeeUser(session.role, target.role)) {
      redirect("/usuarios");
    }
    if (target.role === "ADMINISTRADOR") await guard(true);
    const version = parseVersion(formData.get("version"));
    const password = optionalText(formData.get("password"));
    if (password && password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");
    const limits = limitsFrom(target.role, formData);
    const updated = await prisma.user.updateMany({
      where: { id, version },
      data: {
        name: requiredText(formData.get("name"), "Nombre"),
        ...(password ? { passwordHash: hashPassword(password) } : {}),
        ...limits,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await setFlash({ tone: "ok", message: "Usuario actualizado." });
    redirect(`/usuarios/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/usuarios/${id}`);
  }
}

export async function setUserActiveAction(formData: FormData) {
  "use server";
  const id = requiredText(formData.get("id"), "Usuario");
  try {
    const session = await guard();
    if (id === session.userId) throw new Error("No puedes desactivar tu propia sesión desde aquí.");
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || !isRole(target.role) || !canSeeUser(session.role, target.role)) redirect("/usuarios");
    if (target.role === "ADMINISTRADOR") {
      await guard(true);
      if (target.active) {
        const others = await prisma.user.count({ where: { role: "ADMINISTRADOR", active: true, id: { not: id } } });
        if (others === 0) throw new Error("Debe permanecer al menos un Administrador activo.");
      }
    }
    const active = formData.get("active") === "si";
    const updated = await prisma.user.updateMany({
      where: { id, version: parseVersion(formData.get("version")) },
      data: { active, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    if (!active) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    await recordHistory({
      entityType: "USUARIO",
      entityId: id,
      action: active ? "REACTIVACION" : "DESACTIVACION",
      summary: active ? "Usuario reactivado." : "Usuario desactivado. Las sesiones abiertas se cerraron.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: active ? "Usuario reactivado." : "Usuario desactivado." });
    redirect(`/usuarios/${id}`);
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: messageOf(error) });
    redirect(`/usuarios/${id}`);
  }
}

function limitsFrom(role: Role, formData: FormData) {
  if (role === "VENTAS") {
    const raw = optionalText(formData.get("discountLimitPct"));
    if (!raw) return { discountLimitPct: null };
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("El límite de descuento debe estar entre 0 y 100.");
    return { discountLimitPct: n };
  }
  if (isPurchaseManager(role)) {
    const monthly = Number(optionalText(formData.get("monthlyPurchaseBudget")) ?? DEFAULT_MONTHLY_PURCHASE);
    const limit = Number(optionalText(formData.get("purchaseLimit")) ?? DEFAULT_PURCHASE_LIMIT);
    if (!Number.isFinite(monthly) || monthly < 0 || !Number.isFinite(limit) || limit < 0) {
      throw new Error("Los límites de compra no son válidos.");
    }
    return { monthlyPurchaseBudget: monthly, purchaseLimit: limit };
  }
  return {};
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
