import { redirect } from "next/navigation";
import { prismaProd } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { optionalText, requiredText } from "@/lib/form";
import { verifyPassword } from "@/lib/crypto";
import { homePath } from "@/lib/home";
import { needsExplicitCompany } from "@/lib/permissions";
import { isRole } from "@/lib/roles";
import { endSession, requireSession, setActiveCompany, startSession } from "@/lib/session";

export async function loginAction(formData: FormData) {
  "use server";
  const username = optionalText(formData.get("username"));
  const password = optionalText(formData.get("password"));
  if (!username || !password) {
    await setFlash({ tone: "error", message: "Indica usuario y contraseña." });
    redirect("/login");
  }
  const session = await startSession(username, password);
  if (!session) {
    await setFlash({ tone: "error", message: "Usuario o contraseña incorrectos, o la cuenta está inactiva." });
    redirect("/login");
  }
  if (!session.activeCompanyId) redirect("/empresa");
  redirect(homePath(session.role, session.activeCompanyCode));
}

export async function logoutAction() {
  "use server";
  await endSession();
  redirect("/login");
}

export async function switchCompanyAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const companyId = optionalText(formData.get("companyId"));
  if (!companyId) {
    await setFlash({ tone: "error", message: "Selecciona una empresa." });
    redirect("/empresa");
  }
  const company = await prismaProd.company.findUnique({ where: { id: companyId } });
  if (!company) {
    await setFlash({ tone: "error", message: "La empresa no existe." });
    redirect("/empresa");
  }
  if (session.homeCompanyId && session.homeCompanyId !== company.id) {
    await setFlash({ tone: "error", message: "Tu usuario opera en una sola empresa." });
    redirect("/inicio");
  }
  await setActiveCompany(session.sessionId, company.id);
  const next = optionalText(formData.get("next")) ?? homePath(session.role, company.code);
  redirect(next.startsWith("/") ? next : homePath(session.role, company.code));
}

export async function viewAsAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  if (session.realRole !== "ADMINISTRADOR") {
    await setFlash({ tone: "error", message: "Solo el Administrador puede ver como otro perfil." });
    redirect("/inicio");
  }
  const userId = optionalText(formData.get("userId"));
  if (!userId) {
    await prismaProd.session.update({
      where: { id: session.sessionId },
      data: { impersonatedUserId: null },
    });
    redirect("/inicio");
  }
  const target = await prismaProd.user.findUnique({ where: { id: userId } });
  if (!target || !target.active || !isRole(target.role) || target.role === "ADMINISTRADOR") {
    await setFlash({ tone: "error", message: "Esa cuenta no se puede usar para ver el sistema." });
    redirect("/inicio");
  }
  await prismaProd.session.update({
    where: { id: session.sessionId },
    data: {
      impersonatedUserId: target.id,
      activeCompanyId: needsExplicitCompany(target.role) ? null : target.companyId,
    },
  });
  const company = target.companyId
    ? await prismaProd.company.findUnique({ where: { id: target.companyId }, select: { code: true } })
    : null;
  redirect(needsExplicitCompany(target.role) ? "/empresa" : homePath(target.role, company?.code ?? null));
}

export async function changeOwnPasswordAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  if (session.impersonating) {
    await setFlash({ tone: "error", message: "Vuelve al Administrador antes de cambiar una contraseña." });
    redirect("/cuenta");
  }
  const current = requiredText(formData.get("current"), "Contraseña actual");
  const next = requiredText(formData.get("next"), "Contraseña nueva");
  if (next.length < 10) throw new Error("La contraseña nueva debe tener al menos 10 caracteres.");
  const user = await prismaProd.user.findUnique({ where: { id: session.userId } });
  if (!user || !verifyPassword(current, user.passwordHash)) {
    await setFlash({ tone: "error", message: "La contraseña actual no coincide." });
    redirect("/cuenta");
  }
  const { hashPassword } = await import("@/lib/crypto");
  await prismaProd.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  await setFlash({ tone: "ok", message: "Contraseña actualizada." });
  redirect("/cuenta");
}
