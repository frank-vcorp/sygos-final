import nodemailer from "nodemailer";
import { decryptSecret } from "./crypto";
import { inSandbox, prismaProd } from "./db";

export const DEFAULT_SMTP_HOST = "smtp.sendgrid.net";
export const DEFAULT_SMTP_PORT = 587;
export const SUPPORTED_SMTP_PORTS = [587, 465, 25] as const;
export const DEFAULT_SMTP_USERNAME = "apikey";

export type SupportedSmtpPort = (typeof SUPPORTED_SMTP_PORTS)[number];

export type SendGridSmtpExtra = {
  enabled: boolean;
  host: string;
  port: SupportedSmtpPort;
  username: string;
  fromEmail: string;
  fromName: string;
};

export type SendGridSmtpConfig = SendGridSmtpExtra & {
  secret: string | null;
  secretHint: string | null;
  hasSecret: boolean;
  source: "db" | "env" | "none";
};

export function normalizeSmtpPort(value: unknown): SupportedSmtpPort {
  const num = Number(value);
  if (num === 465) return 465;
  if (num === 25) return 25;
  return 587;
}

export function parseSendGridExtra(
  raw: string | null | undefined,
  defaultFromName = "",
): SendGridSmtpExtra {
  if (!raw) {
    return {
      enabled: true,
      host: DEFAULT_SMTP_HOST,
      port: DEFAULT_SMTP_PORT,
      username: DEFAULT_SMTP_USERNAME,
      fromEmail: "",
      fromName: defaultFromName,
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<{
      enabled: boolean;
      host: string;
      port: number | string;
      username: string;
      fromEmail: string;
      fromName: string;
    }>;
    return {
      enabled: parsed.enabled !== false,
      host: parsed.host?.trim() || DEFAULT_SMTP_HOST,
      port: normalizeSmtpPort(parsed.port),
      username: parsed.username?.trim() || DEFAULT_SMTP_USERNAME,
      fromEmail: parsed.fromEmail?.trim() || "",
      fromName: parsed.fromName?.trim() || defaultFromName,
    };
  } catch {
    return {
      enabled: true,
      host: DEFAULT_SMTP_HOST,
      port: DEFAULT_SMTP_PORT,
      username: DEFAULT_SMTP_USERNAME,
      fromEmail: "",
      fromName: defaultFromName,
    };
  }
}

export function serializeSendGridExtra(input: Partial<SendGridSmtpExtra>): string {
  const clean: SendGridSmtpExtra = {
    enabled: input.enabled !== false,
    host: input.host?.trim() || DEFAULT_SMTP_HOST,
    port: normalizeSmtpPort(input.port),
    username: input.username?.trim() || DEFAULT_SMTP_USERNAME,
    fromEmail: input.fromEmail?.trim() || "",
    fromName: input.fromName?.trim() || "",
  };
  return JSON.stringify(clean);
}

export function formatFromHeader(fromEmail: string, fromName?: string | null): string {
  const email = fromEmail.trim();
  const name = (fromName ?? "").trim().replace(/["<>]/g, "");
  if (!name) return email;
  return `"${name}" <${email}>`;
}

export function sendgridBody(input: {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  if (!input.from) return { error: "Falta el correo remitente verificado en SendGrid." };
  if (!input.to) return { error: "El destinatario no tiene correo." };
  const fromObj: { email: string; name?: string } = { email: input.from.trim() };
  if (input.fromName?.trim()) {
    fromObj.name = input.fromName.trim();
  }
  const content: Array<{ type: string; value: string }> = [{ type: "text/plain", value: input.text }];
  if (input.html?.trim()) {
    content.push({ type: "text/html", value: input.html });
  }
  return {
    body: {
      personalizations: [{ to: [{ email: input.to.trim() }] }],
      from: fromObj,
      subject: input.subject,
      content,
    },
  };
}

export async function getSendGridSmtpConfig(
  companyId?: string | null,
  defaultFromName = "",
): Promise<SendGridSmtpConfig> {
  const rows = await prismaProd.integrationSetting.findMany({
    where: {
      provider: "SENDGRID",
      ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const companyRow = companyId ? rows.find((r) => r.companyId === companyId) : undefined;
  const globalRow = rows.find((r) => r.companyId === null) ?? rows[0];
  const primaryRow = companyRow ?? globalRow;

  if (primaryRow) {
    const extra = parseSendGridExtra(primaryRow.extra, defaultFromName);
    const fallbackExtra =
      companyRow && globalRow ? parseSendGridExtra(globalRow.extra, defaultFromName) : null;
    const enc = primaryRow.secretEnc ?? globalRow?.secretEnc ?? null;
    const hint = primaryRow.secretHint ?? globalRow?.secretHint ?? null;
    let secret: string | null = null;
    if (enc) {
      try {
        secret = decryptSecret(enc);
      } catch {
        secret = null;
      }
    }
    return {
      enabled: extra.enabled,
      host: extra.host || fallbackExtra?.host || DEFAULT_SMTP_HOST,
      port: extra.port || fallbackExtra?.port || DEFAULT_SMTP_PORT,
      username: extra.username || fallbackExtra?.username || DEFAULT_SMTP_USERNAME,
      fromEmail: extra.fromEmail || fallbackExtra?.fromEmail || "",
      fromName: extra.fromName || fallbackExtra?.fromName || defaultFromName,
      secret,
      secretHint: hint,
      hasSecret: Boolean(secret),
      source: "db",
    };
  }

  const envSecret =
    process.env.SMTP_PASS?.trim() ||
    process.env.SENDGRID_API_KEY?.trim() ||
    null;
  const envFromEmail =
    process.env.SMTP_FROM_EMAIL?.trim() ||
    process.env.SENDGRID_FROM_EMAIL?.trim() ||
    "";
  const envFromName =
    process.env.SMTP_FROM_NAME?.trim() ||
    process.env.SENDGRID_FROM_NAME?.trim() ||
    defaultFromName;
  const envHost = process.env.SMTP_HOST?.trim() || DEFAULT_SMTP_HOST;
  const envPort = normalizeSmtpPort(process.env.SMTP_PORT);
  const envUser = process.env.SMTP_USER?.trim() || DEFAULT_SMTP_USERNAME;

  if (envSecret || envFromEmail) {
    return {
      enabled: process.env.SMTP_ENABLED !== "false",
      host: envHost,
      port: envPort,
      username: envUser,
      fromEmail: envFromEmail,
      fromName: envFromName,
      secret: envSecret,
      secretHint: envSecret ? `••••${envSecret.slice(-4)}` : null,
      hasSecret: Boolean(envSecret),
      source: "env",
    };
  }

  return {
    enabled: true,
    host: DEFAULT_SMTP_HOST,
    port: DEFAULT_SMTP_PORT,
    username: DEFAULT_SMTP_USERNAME,
    fromEmail: "",
    fromName: defaultFromName,
    secret: null,
    secretHint: null,
    hasSecret: false,
    source: "none",
  };
}

const SMTP_CONNECTION_TIMEOUT_MS = 10000;
const SMTP_GREETING_TIMEOUT_MS = 10000;
const SMTP_SOCKET_TIMEOUT_MS = 10000;

function createSmtpTransporter(config: {
  host: string;
  port: number;
  username: string;
  secret: string;
}) {
  const port = normalizeSmtpPort(config.port);
  return nodemailer.createTransport({
    host: config.host || DEFAULT_SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user: config.username || DEFAULT_SMTP_USERNAME,
      pass: config.secret,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
  });
}

export function isSendGridHost(host: string) {
  const clean = host.trim().toLowerCase();
  return clean === DEFAULT_SMTP_HOST || clean.endsWith(".sendgrid.net") || clean === "sendgrid.net";
}

export function isSmtpTransportError(message: string) {
  return /ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ESOCKET|ECONNRESET|ENOTFOUND|EAI_AGAIN|timed out|timeout|greeting never|socket closed|connect E/i.test(message);
}

export function parseSendGridErrorBody(status: number, raw: string) {
  const text = raw.trim();
  try {
    const json = JSON.parse(text) as { errors?: Array<{ message?: string; field?: string; help?: string }> };
    if (json.errors?.length) {
      const detail = json.errors
        .map((item) => [item.field, item.message, item.help].filter(Boolean).join(": "))
        .join(" | ");
      return `SendGrid API ${status}: ${detail}`;
    }
  } catch {
    // Body is not JSON.
  }
  return text ? `SendGrid API ${status}: ${text.slice(0, 500)}` : `SendGrid API ${status} sin detalle.`;
}

export async function verifySendGrid(
  secret: string,
  smtpOptions?: { host?: string; port?: number; username?: string },
): Promise<{ ok: boolean; message: string }> {
  const cleanSecret = secret.trim();
  if (!cleanSecret) {
    return { ok: false, message: "Falta la contraseña o API Key de SendGrid SMTP." };
  }
  const host = smtpOptions?.host?.trim() || DEFAULT_SMTP_HOST;
  const port = normalizeSmtpPort(smtpOptions?.port);
  const username = smtpOptions?.username?.trim() || DEFAULT_SMTP_USERNAME;

  try {
    const transporter = createSmtpTransporter({ host, port, username, secret: cleanSecret });
    await transporter.verify();
    return {
      ok: true,
      message: `Conexión SMTP verificada con éxito (${host}:${port}, usuario ${username}).`,
    };
  } catch (smtpError) {
    const smtpMsg = smtpError instanceof Error ? smtpError.message : String(smtpError);
    if (isSendGridHost(host) && cleanSecret.startsWith("SG.")) {
      try {
        const response = await fetch("https://api.sendgrid.com/v3/scopes", {
          headers: { Authorization: `Bearer ${cleanSecret}` },
        });
        if (response.ok) {
          return {
            ok: true,
            message: `SMTP ${host}:${port} no conectó (${smtpMsg}). La API Key de SendGrid sí es válida. El remitente tiene que estar verificado en SendGrid.`,
          };
        }
        const detail = await response.text();
        return {
          ok: false,
          message: `SMTP ${host}:${port}: ${smtpMsg}. ${parseSendGridErrorBody(response.status, detail)}`,
        };
      } catch (apiError) {
        const apiMsg = apiError instanceof Error ? apiError.message : String(apiError);
        return {
          ok: false,
          message: `SMTP ${host}:${port}: ${smtpMsg}. SendGrid API no respondió: ${apiMsg}`,
        };
      }
    }
    return {
      ok: false,
      message: `Error al verificar SMTP (${host}:${port}): ${smtpMsg}`,
    };
  }
}

export type SendEmailOverrides = {
  host?: string | null;
  port?: number | null;
  username?: string | null;
  secret?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
};

export type SendEmailResult = {
  ok: boolean;
  message: string;
  channel?: "smtp" | "api";
  messageId?: string | null;
  response?: string | null;
};

async function sendViaSmtp(input: {
  host: string;
  port: number;
  username: string;
  secret: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const transporter = createSmtpTransporter(input);
  const info = await transporter.sendMail({
    from: formatFromHeader(input.fromEmail, input.fromName),
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
  });
  const rejected = Array.isArray(info.rejected) ? info.rejected.map(String).filter(Boolean) : [];
  const response = typeof info.response === "string" ? info.response : "";
  const messageId = typeof info.messageId === "string" ? info.messageId : null;
  if (rejected.length > 0) {
    return {
      ok: false,
      channel: "smtp",
      messageId,
      response,
      message: `SMTP rechazó el correo (${input.host}:${input.port}). Destinatarios rechazados: ${rejected.join(", ")}. Respuesta: ${response || "sin respuesta del servidor"}.`,
    };
  }
  return {
    ok: true,
    channel: "smtp",
    messageId,
    response,
    message: `SendGrid SMTP aceptó el correo para ${input.to} (${input.host}:${input.port}). Respuesta: ${response || "250 Ok"}.${messageId ? ` Message-ID: ${messageId}.` : ""} Si no llega, revisa spam y que ${input.fromEmail} sea un Sender Identity verificado en SendGrid.`,
  };
}

async function sendViaSendGridApi(input: {
  secret: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const payload = sendgridBody({
    from: input.fromEmail,
    fromName: input.fromName,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  if ("error" in payload && payload.error) {
    return { ok: false, channel: "api", message: payload.error };
  }
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload.body),
  });
  const messageId = response.headers.get("x-message-id");
  if (response.status === 202 || response.ok) {
    return {
      ok: true,
      channel: "api",
      messageId,
      response: `HTTP ${response.status}`,
      message: `SendGrid API aceptó el correo para ${input.to} (HTTP ${response.status}).${messageId ? ` x-message-id: ${messageId}.` : ""} Revisa la bandeja y spam. El remitente ${input.fromEmail} debe ser un Sender Identity verificado.`,
    };
  }
  const detail = await response.text();
  return {
    ok: false,
    channel: "api",
    messageId,
    response: `HTTP ${response.status}`,
    message: parseSendGridErrorBody(response.status, detail),
  };
}

export async function sendSystemEmail(input: {
  companyId?: string | null;
  to: string;
  subject: string;
  text: string;
  html?: string;
  ignoreEnabled?: boolean;
  overrides?: SendEmailOverrides;
}): Promise<SendEmailResult> {
  if (await inSandbox()) {
    return { ok: false, message: "PRUEBA / SIN VALIDEZ. No se envió correo porque la sesión está en modo de pruebas." };
  }
  const to = input.to.trim();
  if (!to) {
    return { ok: false, message: "El destinatario no tiene correo electrónico." };
  }
  const stored = await getSendGridSmtpConfig(input.companyId);
  const overrides = input.overrides ?? {};
  const host = overrides.host?.trim() || stored.host || DEFAULT_SMTP_HOST;
  const port = overrides.port ? normalizeSmtpPort(overrides.port) : stored.port;
  const username = overrides.username?.trim() || stored.username || DEFAULT_SMTP_USERNAME;
  const secret = overrides.secret?.trim() || stored.secret || "";
  const fromEmail = overrides.fromEmail?.trim() || stored.fromEmail;
  const fromName = overrides.fromName?.trim() || stored.fromName;

  if (!secret) {
    return {
      ok: false,
      message: "No hay API Key / contraseña SMTP guardada. Guarda primero la configuración de SendGrid.",
    };
  }
  if (!fromEmail) {
    return {
      ok: false,
      message: "Falta el correo remitente. Captúralo en el formulario de SendGrid SMTP y vuelve a intentar.",
    };
  }
  if (!stored.enabled && !input.ignoreEnabled) {
    return {
      ok: false,
      message: "El envío de correo (SendGrid SMTP) está Deshabilitado en Configuración. Cámbialo a Habilitado y guarda.",
    };
  }

  const mail = { host, port, username, secret, fromEmail, fromName, to, subject: input.subject, text: input.text, html: input.html };
  let smtpFailure = "";
  try {
    const smtp = await sendViaSmtp(mail);
    if (smtp.ok) {
      return input.ignoreEnabled && !stored.enabled
        ? { ...smtp, message: `${smtp.message} El servicio está Deshabilitado para envíos normales; esta prueba se envió igual.` }
        : smtp;
    }
    smtpFailure = smtp.message;
  } catch (error) {
    const smtpMsg = error instanceof Error ? error.message : String(error);
    smtpFailure = `SMTP ${host}:${port} falló: ${smtpMsg}`;
  }

  const canUseApi = secret.startsWith("SG.") && isSendGridHost(host);
  if (!canUseApi) {
    return { ok: false, channel: "smtp", message: smtpFailure };
  }

  try {
    const api = await sendViaSendGridApi(mail);
    if (api.ok) {
      const note = isSmtpTransportError(smtpFailure)
        ? ` El puerto SMTP ${port} no respondió (${smtpFailure}), así que se usó la API Web de SendGrid.`
        : ` SMTP no entregó el correo (${smtpFailure}).`;
      return {
        ...api,
        message: `${api.message}${note}`,
      };
    }
    return {
      ok: false,
      channel: "api",
      message: `${smtpFailure} · ${api.message}`,
      messageId: api.messageId,
      response: api.response,
    };
  } catch (error) {
    const apiMsg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message: `${smtpFailure} · SendGrid API no respondió: ${apiMsg}`,
    };
  }
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  companyId?: string | null;
}) {
  return sendSystemEmail(input);
}
