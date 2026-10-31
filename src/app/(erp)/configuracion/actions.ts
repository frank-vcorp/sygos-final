"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { encryptSecret, secretHint } from "@/lib/crypto";
import { verifyFacturapi } from "@/lib/facturapi";
import {
  DEFAULT_SMTP_HOST,
  DEFAULT_SMTP_USERNAME,
  getSendGridSmtpConfig,
  normalizeSmtpPort,
  serializeSendGridExtra,
  sendSystemEmail,
  verifySendGrid,
} from "@/lib/sendgrid";
import { setFlash } from "@/lib/flash";
import { ConcurrencyError, optionalInt, optionalText, parseVersion } from "@/lib/form";
import { recordHistory } from "@/lib/history";
import { can } from "@/lib/permissions";
import { parseRegimen } from "@/lib/sat-regimen";
import { requireCompany } from "@/lib/session";

function safeReturnUrl(formData?: FormData, fallback = "/configuracion") {
  const custom = formData ? optionalText(formData.get("returnTo")) : null;
  if (custom && custom.startsWith("/configuracion")) return custom;
  return fallback;
}

function redirectWithNotice(target: string, tone: "ok" | "error", message: string): never {
  const hashIdx = target.indexOf("#");
  const hash = hashIdx >= 0 ? target.slice(hashIdx) : "";
  const path = hashIdx >= 0 ? target.slice(0, hashIdx) : target;
  const [pathname, existingQuery] = path.split("?", 2);
  const params = new URLSearchParams(existingQuery ?? "");
  params.set("sg", tone);
  params.set("sgm", message.replace(/\s+/g, " ").slice(0, 700));
  const next = `${pathname}?${params.toString()}${hash}`;
  redirect(next);
}

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

async function requireIntegrations(returnUrl = "/configuracion") {
  const session = await requireCompany();
  if (!can(session.role, "config.integrations")) {
    await setFlash({ tone: "error", message: "Solo el Administrador puede configurar integraciones." });
    redirect(returnUrl);
  }
  return session;
}

export async function saveFacturapiAction(formData: FormData) {
  "use server";
  const back = safeReturnUrl(formData, "/configuracion#integraciones");
  const session = await requireIntegrations(back);
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
  redirect(back);
}

export async function verifyFacturapiAction(formData: FormData) {
  "use server";
  const back = safeReturnUrl(formData, "/configuracion#integraciones");
  const session = await requireIntegrations(back);
  const row = await prisma.integrationSetting.findFirst({ where: { provider: "FACTURAPI", companyId: session.activeCompanyId } });
  if (!row?.secretEnc) {
    await setFlash({ tone: "error", message: "Esta empresa no tiene llave de Facturapi." });
    redirect(back);
  }
  const { decryptSecret } = await import("@/lib/crypto");
  const result = await verifyFacturapi(decryptSecret(row.secretEnc));
  await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  redirect(back);
}

export async function saveSendgridAction(formData: FormData) {
  "use server";
  const back = safeReturnUrl(formData, "/configuracion#integraciones");
  const session = await requireIntegrations(back);

  const enabled = formData.get("enabled") !== "no";
  const host = optionalText(formData.get("host")) || DEFAULT_SMTP_HOST;
  const port = normalizeSmtpPort(formData.get("port"));
  const username = optionalText(formData.get("username")) || DEFAULT_SMTP_USERNAME;
  const secret = optionalText(formData.get("secret"));
  const fromEmail = optionalText(formData.get("fromEmail")) ?? "";
  const fromName = optionalText(formData.get("fromName")) ?? session.activeCompanyName;

  if (enabled && !fromEmail) {
    const message = "SendGrid SMTP necesita el correo remitente verificado.";
    await setFlash({ tone: "error", message });
    redirectWithNotice(back, "error", message);
  }

  const existingCompany = await prisma.integrationSetting.findFirst({
    where: { provider: "SENDGRID", companyId: session.activeCompanyId },
  });
  const existingGlobal = await prisma.integrationSetting.findFirst({
    where: { provider: "SENDGRID", companyId: null },
  });

  const savedSecretEnc = existingCompany?.secretEnc ?? existingGlobal?.secretEnc ?? null;
  const savedSecretHint = existingCompany?.secretHint ?? existingGlobal?.secretHint ?? null;

  if (enabled && !secret && !savedSecretEnc) {
    const message = "No hay API Key / contraseña SMTP guardada. Guarda primero la configuración de SendGrid.";
    await setFlash({ tone: "error", message });
    redirectWithNotice(back, "error", message);
  }

  const nextSecretEnc = secret ? encryptSecret(secret) : savedSecretEnc;
  const nextSecretHint = secret ? secretHint(secret) : savedSecretHint;
  const extra = serializeSendGridExtra({
    enabled,
    host,
    port,
    username,
    fromEmail,
    fromName,
  });

  const payload = {
    extra,
    secretEnc: nextSecretEnc,
    secretHint: nextSecretHint,
  };

  if (existingCompany) {
    await prisma.integrationSetting.update({ where: { id: existingCompany.id }, data: payload });
  } else {
    await prisma.integrationSetting.create({
      data: { provider: "SENDGRID", companyId: session.activeCompanyId, ...payload },
    });
  }

  if (existingGlobal) {
    await prisma.integrationSetting.update({ where: { id: existingGlobal.id }, data: payload });
  } else {
    await prisma.integrationSetting.create({
      data: { provider: "SENDGRID", companyId: null, ...payload },
    });
  }

  await recordHistory({
    companyId: session.activeCompanyId,
    entityType: "EMPRESA",
    entityId: session.activeCompanyId,
    action: "SENDGRID_SMTP",
    summary: `Configuración SendGrid SMTP Relay actualizada (${host}:${port}, usuario ${username}, estado ${enabled ? "Habilitado" : "Deshabilitado"}).`,
    authorUserId: session.userId,
  });

  const message = secret
    ? `SendGrid SMTP (${host}:${port}) y nueva API Key guardados.`
    : `Configuración SendGrid SMTP (${host}:${port}) guardada conservando la API Key existente.`;
  await setFlash({ tone: "ok", message });
  redirectWithNotice(back, "ok", message);
}

export async function verifySendgridAction(formData: FormData) {
  "use server";
  const back = safeReturnUrl(formData, "/configuracion#integraciones");
  const session = await requireIntegrations(back);

  const stored = await getSendGridSmtpConfig(session.activeCompanyId, session.activeCompanyName);
  const secretInput = optionalText(formData.get("secret"));
  const secret = secretInput ?? stored.secret;

  if (!secret) {
    const message = "No hay API Key / contraseña SMTP guardada. Guarda primero la configuración de SendGrid.";
    await setFlash({ tone: "error", message });
    redirectWithNotice(back, "error", message);
  }

  const host = optionalText(formData.get("host")) || stored.host || DEFAULT_SMTP_HOST;
  const port = formData.get("port") ? normalizeSmtpPort(formData.get("port")) : stored.port;
  const username = optionalText(formData.get("username")) || stored.username || DEFAULT_SMTP_USERNAME;

  let result: { ok: boolean; message: string };
  try {
    result = await verifySendGrid(secret, { host, port, username });
  } catch (error) {
    if (isRedirect(error)) throw error;
    result = {
      ok: false,
      message: error instanceof Error && !isRedirectMessage(error.message)
        ? error.message
        : "No se pudo verificar SendGrid SMTP.",
    };
  }
  await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  redirectWithNotice(back, result.ok ? "ok" : "error", result.message);
}

export async function sendTestEmailAction(formData: FormData) {
  "use server";
  const back = safeReturnUrl(formData, "/configuracion#integraciones");
  const session = await requireIntegrations(back);

  const toEmail = optionalText(formData.get("toEmail"));
  if (!toEmail) {
    const message = "Ingresa un correo destinatario para enviar el correo de prueba.";
    await setFlash({ tone: "error", message });
    redirectWithNotice(back, "error", message);
  }

  const host = optionalText(formData.get("host")) || DEFAULT_SMTP_HOST;
  const port = normalizeSmtpPort(formData.get("port"));
  const username = optionalText(formData.get("username")) || DEFAULT_SMTP_USERNAME;
  const secret = optionalText(formData.get("secret"));
  const fromEmail = optionalText(formData.get("fromEmail")) ?? "";
  const fromName = optionalText(formData.get("fromName")) ?? session.activeCompanyName;
  const subject =
    optionalText(formData.get("testSubject")) ||
    `Correo de prueba SMTP · ${session.activeCompanyName} (SYGOS 3.0)`;
  const bodyText =
    optionalText(formData.get("testBody")) ||
    [
      "Hola,",
      "",
      `Este es un correo de prueba enviado desde SYGOS 3.0 (${session.activeCompanyName}) a través de SendGrid.`,
      `Servidor SMTP: ${host}:${port}`,
      `Usuario SMTP: ${username}`,
      `Remitente: ${fromName ? `${fromName} <${fromEmail || "sin correo"}> ` : fromEmail || "sin correo"}`,
      "",
      "Si recibes este mensaje, la integración está funcionando.",
    ].join("\n");

  let result: { ok: boolean; message: string };
  try {
    result = await sendSystemEmail({
      companyId: session.activeCompanyId,
      to: toEmail,
      subject,
      text: bodyText,
      ignoreEnabled: true,
      overrides: { host, port, username, secret, fromEmail, fromName },
    });
  } catch (error) {
    if (isRedirect(error)) throw error;
    result = {
      ok: false,
      message: error instanceof Error && !isRedirectMessage(error.message)
        ? error.message
        : "No se pudo enviar el correo de prueba.",
    };
  }
  await setFlash({ tone: result.ok ? "ok" : "error", message: result.message });
  redirectWithNotice(back, result.ok ? "ok" : "error", result.message);
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

function isRedirect(error: unknown) {
  if (typeof error === "object" && error !== null && "digest" in error) {
    if (String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) return true;
  }
  if (error instanceof Error && isRedirectMessage(error.message)) return true;
  return false;
}

function isRedirectMessage(message: string) {
  return message === "NEXT_REDIRECT" || message.startsWith("NEXT_REDIRECT;");
}
