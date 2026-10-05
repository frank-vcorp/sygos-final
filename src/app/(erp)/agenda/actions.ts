"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { setFlash } from "@/lib/flash";
import { optionalText, requiredText } from "@/lib/form";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export async function createActivityAction(formData: FormData) {
  "use server";
  try {
    const session = await requireCompany();
    if (!can(session.role, "agenda.use", session.activeCompanyCode)) throw new Error("No tienes agenda comercial.");
    const scheduledAt = new Date(requiredText(formData.get("scheduledAt"), "Fecha"));
    if (Number.isNaN(scheduledAt.getTime())) throw new Error("La fecha no es válida.");
    await prisma.agendaActivity.create({
      data: {
        companyId: session.activeCompanyId,
        authorUserId: session.userId,
        categoryId: optionalText(formData.get("categoryId")),
        note: requiredText(formData.get("note"), "Nota"),
        evidence: optionalText(formData.get("evidence")),
        scheduledAt,
      },
    });
    await setFlash({ tone: "ok", message: "Actividad registrada. No se creó un recordatorio." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar." });
  }
  redirect("/agenda");
}

export async function saveGoalAction(formData: FormData) {
  "use server";
  try {
    const session = await requireCompany();
    if (!can(session.role, "goals.manage", session.activeCompanyCode)) throw new Error("Solo CEO o Administrador definen metas de SYSTRON.");
    const now = new Date();
    await prisma.salesGoal.upsert({
      where: {
        companyId_userId_goalTypeId_year_month: {
          companyId: session.activeCompanyId,
          userId: requiredText(formData.get("userId"), "Vendedor"),
          goalTypeId: requiredText(formData.get("goalTypeId"), "Meta"),
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      },
      update: { target: Number(formData.get("target")) },
      create: {
        companyId: session.activeCompanyId,
        userId: requiredText(formData.get("userId"), "Vendedor"),
        goalTypeId: requiredText(formData.get("goalTypeId"), "Meta"),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        target: Number(formData.get("target")),
      },
    });
    await setFlash({ tone: "ok", message: "Objetivo del mes actualizado. Un mes cerrado conserva el suyo." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar." });
  }
  redirect("/agenda");
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
