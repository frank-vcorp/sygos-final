import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { encryptSecret, secretHint } from "@/lib/crypto";
import { setFlash } from "@/lib/flash";
import { ConcurrencyError, optionalInt, optionalText, parseVersion, requiredText } from "@/lib/form";
import { recordHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { parseRegimen } from "@/lib/sat-regimen";
import { requireCompany } from "@/lib/session";

export async function updateCompanyAction(formData: FormData) {
  "use server";
  const session = await requireCompany();
  if (!can(session.role, "config.company")) {
    await setFlash({ tone: "error", message: "No tienes permiso para la configuración de la empresa." });
    redirect("/inicio");
  }
  try {
    const updated = await prisma.company.updateMany({
      where: { id: session.activeCompanyId, version: parseVersion(formData.get("version")) },
      data: {
        legalName: optionalText(formData.get("legalName")),
        rfc: optionalText(formData.get("rfc")),
        taxRegime: parseRegimen(formData.get("taxRegime")),
        postalCode: optionalText(formData.get("postalCode")),
        fiscalAddress: optionalText(formData.get("fiscalAddress")),
        phone: optionalText(formData.get("phone")),
        email: optionalText(formData.get("email")),
        defaultCreditDays: optionalInt(formData.get("defaultCreditDays")),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await recordHistory({
      companyId: session.activeCompanyId,
      entityType: "EMPRESA",
      entityId: session.activeCompanyId,
      action: "CONFIGURACION",
      summary: "Identidad y parámetros de la empresa actualizados. No altera la otra empresa.",
      authorUserId: session.userId,
    });
    await setFlash({ tone: "ok", message: "Configuración de la empresa guardada." });
  } catch (error) {
    if (isRedirect(error)) throw error;
    await setFlash({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar." });
  }
  redirect("/configuracion");
}

export async function saveIntegrationAction(formData: FormData) {
  "use server";
  const session = await requireCompany();
  if (!can(session.role, "config.integrations")) {
    await setFlash({ tone: "error", message: "Solo el Administrador configura integraciones." });
    redirect("/configuracion");
  }
  const provider = requiredText(formData.get("provider"), "Integración");
  if (!["FACTURAPI", "SENDGRID", "WHATSAPP"].includes(provider)) {
    await setFlash({ tone: "error", message: "Integración no reconocida." });
    redirect("/configuracion");
  }
  const secret = optionalText(formData.get("secret"));
  if (!secret) {
    await setFlash({ tone: "error", message: "Falta la credencial. La integración sigue desconectada." });
    redirect("/configuracion");
  }
  const companyId = provider === "FACTURAPI" ? session.activeCompanyId : null;
  const existing = await prisma.integrationSetting.findFirst({ where: { provider, companyId } });
  const data = { secretEnc: encryptSecret(secret), secretHint: secretHint(secret) };
  if (existing) {
    await prisma.integrationSetting.update({ where: { id: existing.id }, data });
  } else {
    await prisma.integrationSetting.create({ data: { provider, companyId, ...data } });
  }
  await recordHistory({
    companyId,
    entityType: "INTEGRACION",
    entityId: existing?.id ?? provider,
    action: "CREDENCIAL",
    summary: `${provider} quedó configurada. La credencial no se vuelve a mostrar.`,
    authorUserId: session.userId,
  });
  await setFlash({
    tone: "ok",
    message: "Credencial guardada. No se ejecutó ninguna prueba externa ni se simuló un envío exitoso.",
  });
  redirect("/configuracion");
}

export async function toggleInventoryAction(formData: FormData) {
  "use server";
  const session = await requireCompany();
  if (session.role !== "ADMINISTRADOR" || session.activeCompanyCode !== "SERVOMOTORES") {
    await setFlash({ tone: "error", message: "Solo el Administrador habilita el inventario de Servomotores." });
    redirect("/configuracion");
  }
  const enable = formData.get("enabled") === "si";
  await prisma.company.update({
    where: { id: session.activeCompanyId },
    data: { inventoryEnabled: enable, version: { increment: 1 } },
  });
  await recordHistory({
    companyId: session.activeCompanyId,
    entityType: "EMPRESA",
    entityId: session.activeCompanyId,
    action: "INVENTARIO",
    summary: enable
      ? "Inventario de Servomotores habilitado. No se copian existencias de SYSTRON."
      : "Inventario de Servomotores deshabilitado.",
    authorUserId: session.userId,
  });
  await setFlash({ tone: "ok", message: enable ? "Inventario habilitado para Servomotores." : "Inventario deshabilitado." });
  redirect("/configuracion");
}

export async function updatePriorityAction(formData: FormData) {
  "use server";
  const session = await requireCompany();
  if (!can(session.role, "config.company")) {
    await setFlash({ tone: "error", message: "No tienes permiso para las prioridades." });
    redirect("/configuracion");
  }
  const id = requiredText(formData.get("priorityId"), "Prioridad");
  const slaMaxDays = optionalInt(formData.get("slaMaxDays"));
  if (slaMaxDays == null || slaMaxDays < 1) {
    await setFlash({ tone: "error", message: "El SLA máximo debe ser al menos un día hábil." });
    redirect("/configuracion");
  }
  const updated = await prisma.priority.updateMany({
    where: { id, companyId: session.activeCompanyId },
    data: {
      price: optionalMoney(formData.get("price")),
      incrementPct: optionalMoney(formData.get("incrementPct")),
      targetMinDays: optionalInt(formData.get("targetMinDays")),
      targetMaxDays: optionalInt(formData.get("targetMaxDays")),
      slaMaxDays,
    },
  });
  if (updated.count === 0) {
    await setFlash({ tone: "error", message: "Esa prioridad no es de esta empresa." });
    redirect("/configuracion");
  }
  await setFlash({ tone: "ok", message: "Prioridad actualizada. Los casos ya abiertos conservan la fotografía anterior." });
  redirect("/configuracion");
}

function optionalMoney(value: FormDataEntryValue | null) {
  const text = optionalText(value);
  if (!text) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("El importe no es válido.");
  return amount;
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
