import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { encryptSecret, secretHint } from "@/lib/crypto";
import { verifyFacturapi } from "@/lib/facturapi";
import { verifySendGrid } from "@/lib/sendgrid";
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

async function requireIntegrations() {
  const session = await requireCompany();
  if (!can(session.role, "config.integrations")) {
    await setFlash({ tone: "error", message: "Solo el Administrador configura integraciones." });
    redirect("/configuracion");
  }
  return session;
}

export async function saveFacturapiAction(formData: FormData) {
  "use server";
  const session = await requireIntegrations();
  const secret = optionalText(formData.get("secret"));
  const extra = JSON.stringify({
    registroPatronal: optionalText(formData.get("registroPatronal")),
    employerCurp: optionalText(formData.get("employerCurp")),
    employerState: optionalText(formData.get("employerState")),
  });
  await prisma.company.update({
    where: { id: session.activeCompanyId },
    data: {
      registroPatronal: optionalText(formData.get("registroPatronal")),
      employerCurp: optionalText(formData.get("employerCurp")),
      employerState: optionalText(formData.get("employerState")),
    },
  });
  const existing = await prisma.integrationSetting.findFirst({ where: { provider: "FACTURAPI", companyId: session.activeCompanyId } });
  if (secret) {
    const data = { secretEnc: encryptSecret(secret), secretHint: secretHint(secret), extra };
    if (existing) await prisma.integrationSetting.update({ where: { id: existing.id }, data });
    else await prisma.integrationSetting.create({ data: { provider: "FACTURAPI", companyId: session.activeCompanyId, ...data } });
  } else if (existing) {
    await prisma.integrationSetting.update({ where: { id: existing.id }, data: { extra } });
  }
  await setFlash({ tone: "ok", message: secret ? "Llave de Facturapi guardada. El certificado de sello sigue en Facturapi, no aquí." : "Datos de nómina guardados. La llave no cambió." });
  redirect("/configuracion");
}

export async function verifyFacturapiAction() {
  "use server";
  const session = await requireIntegrations();
  const row = await prisma.integrationSetting.findFirst({ where: { provider: "FACTURAPI", companyId: session.activeCompanyId } });
  if (!row?.secretEnc) {
    await setFlash({ tone: "error", message: "Esta empresa no tiene llave de Facturapi." });
    redirect("/configuracion");
  }
  const { decryptSecret } = await import("@/lib/crypto");
  const result = await verifyFacturapi(decryptSecret(row.secretEnc));
  await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  redirect("/configuracion");
}

export async function saveSendgridAction(formData: FormData) {
  "use server";
  await requireIntegrations();
  const secret = optionalText(formData.get("secret"));
  const fromEmail = optionalText(formData.get("fromEmail"));
  if (!fromEmail) {
    await setFlash({ tone: "error", message: "SendGrid necesita el correo remitente verificado, además de la llave." });
    redirect("/configuracion");
  }
  const existing = await prisma.integrationSetting.findFirst({ where: { provider: "SENDGRID", companyId: null } });
  const extra = JSON.stringify({ fromEmail });
  if (!secret && !existing?.secretEnc) {
    await setFlash({ tone: "error", message: "Falta la llave de SendGrid. Empieza con SG." });
    redirect("/configuracion");
  }
  const data = { extra, ...(secret ? { secretEnc: encryptSecret(secret), secretHint: secretHint(secret) } : {}) };
  if (existing) await prisma.integrationSetting.update({ where: { id: existing.id }, data });
  else await prisma.integrationSetting.create({ data: { provider: "SENDGRID", companyId: null, secretEnc: encryptSecret(secret!), secretHint: secretHint(secret!), extra } });
  await setFlash({ tone: "ok", message: "SendGrid guardado. No se envió un correo de prueba." });
  redirect("/configuracion");
}

export async function verifySendgridAction() {
  "use server";
  await requireIntegrations();
  const row = await prisma.integrationSetting.findFirst({ where: { provider: "SENDGRID", companyId: null } });
  if (!row?.secretEnc) {
    await setFlash({ tone: "error", message: "SendGrid no tiene llave." });
    redirect("/configuracion");
  }
  const { decryptSecret } = await import("@/lib/crypto");
  const result = await verifySendGrid(decryptSecret(row.secretEnc));
  await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
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
