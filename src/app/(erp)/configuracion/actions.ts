"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { encryptSecret, secretHint } from "@/lib/crypto";
import { inspectFacturapiOrganization, verifyFacturapi } from "@/lib/facturapi";
import {
  FISCAL_OPERATION_KINDS,
  keyEnvironment,
  loadFacturapiCompanySettings,
  parseCompanyFiscalConfig,
  parseFacturapiExtra,
  serializeFiscalConfigJson,
  syncIntercompanyPartiesFromCompany,
  type FacturapiRunMode,
  type FiscalOperationKind,
  type SatLineDefaults,
} from "@/lib/fiscal-config";
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
    await syncIntercompanyPartiesFromCompany(session.activeCompanyId);
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

async function upsertFacturapiSlot(input: {
  companyId: string;
  provider: "FACTURAPI_TEST" | "FACTURAPI_LIVE";
  secret: string | null;
  webhookSecret: string | null;
  payrollMeta: {
    registroPatronal: string | null;
    employerCurp: string | null;
    employerState: string | null;
  };
  inspected?: Awaited<ReturnType<typeof inspectFacturapiOrganization>> | null;
}) {
  const existing = await prisma.integrationSetting.findFirst({
    where: { provider: input.provider, companyId: input.companyId },
  });
  const currentExtra = parseFacturapiExtra(existing?.extra);
  const nextExtra = {
    ...currentExtra,
    ...input.payrollMeta,
    ...(input.webhookSecret
      ? {
          webhookSecretEnc: encryptSecret(input.webhookSecret),
          webhookSecretHint: secretHint(input.webhookSecret),
        }
      : {}),
    ...(input.inspected?.ok
      ? {
          organizationId: input.inspected.organizationId,
          organizationName: input.inspected.organizationName,
          taxId: input.inspected.taxId,
          isProductionReady: input.inspected.isProductionReady,
          hasCertificate: input.inspected.hasCertificate,
          certificateSerial: input.inspected.certificateSerial,
          certificateExpiresAt: input.inspected.certificateExpiresAt,
          pendingSteps: input.inspected.pendingSteps,
          verifiedAt: new Date().toISOString(),
        }
      : {}),
  };

  const payload = {
    extra: JSON.stringify(nextExtra),
    ...(input.secret
      ? {
          secretEnc: encryptSecret(input.secret),
          secretHint: secretHint(input.secret),
        }
      : {}),
  };

  if (existing) {
    await prisma.integrationSetting.update({ where: { id: existing.id }, data: payload });
  } else if (input.secret || input.webhookSecret || input.inspected?.ok) {
    await prisma.integrationSetting.create({
      data: {
        provider: input.provider,
        companyId: input.companyId,
        ...payload,
      },
    });
  }
}

export async function saveFacturapiAction(formData: FormData) {
  "use server";
  const back = safeReturnUrl(formData, "/configuracion/integraciones#facturapi");
  const session = await requireIntegrations(back);
  const loaded = await loadFacturapiCompanySettings(session.activeCompanyId);

  const requestedModeRaw = optionalText(formData.get("facturapiMode"));
  const facturapiMode: FacturapiRunMode =
    requestedModeRaw === "TEST" || requestedModeRaw === "LIVE" || requestedModeRaw === "OFF"
      ? requestedModeRaw
      : loaded.config.facturapiMode;

  const testSecret = optionalText(formData.get("testSecret")) ?? optionalText(formData.get("secret"));
  const liveSecret = optionalText(formData.get("liveSecret"));
  const testWebhookSecret = optionalText(formData.get("testWebhookSecret"));
  const liveWebhookSecret = optionalText(formData.get("liveWebhookSecret"));

  if (testSecret && keyEnvironment(testSecret) !== "test") {
    await setFlash({ tone: "error", message: "La llave Test debe empezar con sk_test_." });
    redirect(back);
  }
  if (liveSecret && keyEnvironment(liveSecret) !== "live") {
    await setFlash({ tone: "error", message: "La llave Live debe empezar con sk_live_." });
    redirect(back);
  }

  const effectiveTestSecret = testSecret ?? loaded.test.secret;
  const effectiveLiveSecret = liveSecret ?? loaded.live.secret;

  let inspectedTest: Awaited<ReturnType<typeof inspectFacturapiOrganization>> | null = null;
  let inspectedLive: Awaited<ReturnType<typeof inspectFacturapiOrganization>> | null = null;

  if (testSecret) {
    inspectedTest = await inspectFacturapiOrganization(testSecret);
  }
  if (liveSecret) {
    inspectedLive = await inspectFacturapiOrganization(liveSecret);
  }

  if (facturapiMode === "TEST" && !effectiveTestSecret) {
    await setFlash({ tone: "error", message: "Para activar modo Test guarda una llave sk_test_." });
    redirect(back);
  }
  if (facturapiMode === "LIVE") {
    if (!effectiveLiveSecret) {
      await setFlash({ tone: "error", message: "Para activar modo Live guarda una llave sk_live_." });
      redirect(back);
    }
    const orgCheck = inspectedLive ?? await inspectFacturapiOrganization(effectiveLiveSecret);
    inspectedLive = orgCheck;
    if (!orgCheck.ok || !orgCheck.isProductionReady) {
      await setFlash({
        tone: "error",
        message: orgCheck.ok
          ? `No se puede activar modo Live todavía: ${orgCheck.message}`
          : orgCheck.message,
      });
      redirect(back);
    }
  }

  const fiscalSeriesPolicy = formData.get("fiscalSeriesPolicy") === "FACTURAPI_AUTO" ? "FACTURAPI_AUTO" : "SYGOS_FAC";
  const fiscalDefaultSeries = optionalText(formData.get("fiscalDefaultSeries"))?.slice(0, 25) || "FAC";
  const fiscalLineMode = formData.get("fiscalLineMode") === "CONSOLIDATED" ? "CONSOLIDATED" : "LINE_BY_LINE";

  const baseDefaults = loaded.config.satDefaults;
  const satDefaults = {} as Record<FiscalOperationKind, SatLineDefaults>;
  for (const op of FISCAL_OPERATION_KINDS) {
    const rawKey = optionalText(formData.get(`sat_${op.key}_productKey`))?.replace(/\D/g, "") ?? "";
    if (rawKey && rawKey.length !== 8) {
      await setFlash({ tone: "error", message: `La clave SAT de ${op.label} debe tener 8 dígitos.` });
      redirect(back);
    }
    satDefaults[op.key] = {
      productKey: rawKey.length === 8 ? rawKey : baseDefaults[op.key].productKey,
      unitKey: optionalText(formData.get(`sat_${op.key}_unitKey`))?.toUpperCase().slice(0, 6) || baseDefaults[op.key].unitKey,
      unitName: optionalText(formData.get(`sat_${op.key}_unitName`))?.slice(0, 20) || baseDefaults[op.key].unitName,
      taxability: optionalText(formData.get(`sat_${op.key}_taxability`)) || baseDefaults[op.key].taxability,
    };
  }

  const toggles = {
    autoEmailOnStamp: formData.get("autoEmailOnStamp") === "auto",
    autoWhatsAppOnStamp: formData.get("autoWhatsAppOnStamp") === "auto",
    autoRepOnPaymentValidation: formData.get("autoRepOnPaymentValidation") === "auto",
    cancelWithPaymentsPolicy:
      formData.get("cancelWithPaymentsPolicy") === "ALLOW_GUIDED_SUBSTITUTION"
        ? ("ALLOW_GUIDED_SUBSTITUTION" as const)
        : ("BLOCK_UNTIL_REP_CANCELED" as const),
  };

  const payrollMeta = {
    registroPatronal: optionalText(formData.get("registroPatronal")),
    employerCurp: optionalText(formData.get("employerCurp")),
    employerState: optionalText(formData.get("employerState")),
  };

  await prisma.company.update({
    where: { id: session.activeCompanyId },
    data: {
      ...payrollMeta,
      facturapiMode,
      fiscalSeriesPolicy,
      fiscalDefaultSeries,
      fiscalLineMode,
      fiscalConfigJson: serializeFiscalConfigJson({ satDefaults, toggles }),
    },
  });

  await upsertFacturapiSlot({
    companyId: session.activeCompanyId,
    provider: "FACTURAPI_TEST",
    secret: testSecret,
    webhookSecret: testWebhookSecret,
    payrollMeta,
    inspected: inspectedTest,
  });
  await upsertFacturapiSlot({
    companyId: session.activeCompanyId,
    provider: "FACTURAPI_LIVE",
    secret: liveSecret,
    webhookSecret: liveWebhookSecret,
    payrollMeta,
    inspected: inspectedLive,
  });

  const savedConfig = parseCompanyFiscalConfig({
    code: session.activeCompanyCode,
    facturapiMode,
    fiscalSeriesPolicy,
    fiscalDefaultSeries,
    fiscalLineMode,
    fiscalConfigJson: serializeFiscalConfigJson({ satDefaults, toggles }),
  });

  await recordHistory({
    companyId: session.activeCompanyId,
    entityType: "EMPRESA",
    entityId: session.activeCompanyId,
    action: "FACTURAPI_CONFIG",
    summary: `Configuración Facturapi actualizada (modo ${savedConfig.facturapiMode}, folio ${savedConfig.fiscalSeriesPolicy}, partidas ${savedConfig.fiscalLineMode}).`,
    authorUserId: session.userId,
  });

  await setFlash({
    tone: "ok",
    message: `Configuración Facturapi guardada (${savedConfig.facturapiMode === "LIVE" ? "Producción SAT" : savedConfig.facturapiMode === "TEST" ? "Pruebas Sandbox" : "Desactivado"}).`,
  });
  redirect(back);
}

export async function verifyFacturapiAction(formData: FormData) {
  "use server";
  const back = safeReturnUrl(formData, "/configuracion/integraciones#facturapi");
  const session = await requireIntegrations(back);
  const loaded = await loadFacturapiCompanySettings(session.activeCompanyId);
  const target = optionalText(formData.get("verifyTarget"));
  const preferLive = target === "LIVE" || (target !== "TEST" && loaded.config.facturapiMode === "LIVE");

  const inputTest = optionalText(formData.get("testSecret"));
  const inputLive = optionalText(formData.get("liveSecret"));
  const secret = preferLive
    ? (inputLive ?? loaded.live.secret)
    : (inputTest ?? loaded.test.secret ?? loaded.live.secret);

  if (!secret) {
    await setFlash({
      tone: "error",
      message: preferLive
        ? "Esta empresa no tiene llave Live (sk_live_) capturada ni guardada."
        : "Esta empresa no tiene llave de Facturapi capturada ni guardada.",
    });
    redirect(back);
  }

  const keyCheck = await verifyFacturapi(secret);
  if (!keyCheck.ok) {
    await setFlash({ tone: "error", message: keyCheck.message });
    redirect(back);
  }

  const org = await inspectFacturapiOrganization(secret);
  const modeEnv = keyEnvironment(secret);
  if (org.ok && modeEnv) {
    await upsertFacturapiSlot({
      companyId: session.activeCompanyId,
      provider: modeEnv === "live" ? "FACTURAPI_LIVE" : "FACTURAPI_TEST",
      secret: null,
      webhookSecret: null,
      payrollMeta: {
        registroPatronal: loaded.company?.registroPatronal ?? null,
        employerCurp: loaded.company?.employerCurp ?? null,
        employerState: loaded.company?.employerState ?? null,
      },
      inspected: org,
    });
  }

  await setFlash({
    tone: org.ok && (!preferLive || org.isProductionReady) ? "ok" : "error",
    message: org.ok ? `${keyCheck.message} ${org.message}` : keyCheck.message,
  });
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
