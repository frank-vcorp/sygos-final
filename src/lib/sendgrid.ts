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
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
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
    if (host === DEFAULT_SMTP_HOST && cleanSecret.startsWith("SG.")) {
      try {
        const response = await fetch("https://api.sendgrid.com/v3/scopes", {
          headers: { Authorization: `Bearer ${cleanSecret}` },
        });
        if (response.ok) {
          return {
            ok: true,
            message: "La API Key de SendGrid es válida. El remitente debe estar verificado en SendGrid.",
          };
        }
        return {
          ok: false,
          message: `SendGrid rechazó la API Key (${response.status}). Detalle SMTP: ${smtpMsg}`,
        };
      } catch {
        // Fall through to SMTP error message
      }
    }
    return {
      ok: false,
      message: `Error al verificar SMTP (${host}:${port}): ${smtpMsg}`,
    };
  }
}

export async function sendSystemEmail(input: {
  companyId?: string | null;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: boolean; message: string }> {
  if (await inSandbox()) {
    return { ok: false, message: "PRUEBA / SIN VALIDEZ. No se envió correo." };
  }
  const to = input.to.trim();
  if (!to) {
    return { ok: false, message: "El destinatario no tiene correo electrónico." };
  }
  const config = await getSendGridSmtpConfig(input.companyId);
  if (config.source === "none" || (!config.secret && !config.fromEmail)) {
    return {
      ok: false,
      message: "SendGrid SMTP no está configurado. Configúralo en Configuración > Integraciones.",
    };
  }
  if (!config.enabled) {
    return {
      ok: false,
      message: "El envío de correo (SendGrid SMTP) está deshabilitado en Configuración.",
    };
  }
  if (!config.fromEmail) {
    return {
      ok: false,
      message: "Falta el correo remitente verificado en la configuración de SendGrid SMTP.",
    };
  }
  if (!config.secret) {
    return {
      ok: false,
      message: "Falta la contraseña / API Key en la configuración de SendGrid SMTP.",
    };
  }

  try {
    const transporter = createSmtpTransporter({
      host: config.host,
      port: config.port,
      username: config.username,
      secret: config.secret,
    });
    await transporter.sendMail({
      from: formatFromHeader(config.fromEmail, config.fromName),
      to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    });
    return {
      ok: true,
      message: `Correo enviado a ${to} vía ${config.host}:${config.port}.`,
    };
  } catch (smtpError) {
    const smtpMsg = smtpError instanceof Error ? smtpError.message : String(smtpError);
    const isNetworkBlock =
      /ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ESOCKET/i.test(smtpMsg);

    if (isNetworkBlock && config.host === DEFAULT_SMTP_HOST && config.secret.startsWith("SG.")) {
      const payload = sendgridBody({
        from: config.fromEmail,
        fromName: config.fromName,
        to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      if ("error" in payload && payload.error) {
        return { ok: false, message: payload.error };
      }
      try {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload.body),
        });
        if (response.status === 202 || response.ok) {
          return { ok: true, message: `Correo enviado a ${to} vía SendGrid.` };
        }
        const detail = await response.text();
        return {
          ok: false,
          message: detail || `SendGrid rechazó el envío (${response.status}).`,
        };
      } catch {
        // Fall through to report SMTP error
      }
    }

    return {
      ok: false,
      message: `No se pudo enviar el correo por SMTP (${config.host}:${config.port}): ${smtpMsg}`,
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
