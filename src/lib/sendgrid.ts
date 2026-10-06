import { decryptSecret } from "./crypto";
import { inSandbox, prismaProd } from "./db";

export function sendgridBody(input: { from: string; to: string; subject: string; text: string }) {
  if (!input.from) return { error: "Falta el correo remitente verificado en SendGrid." };
  if (!input.to) return { error: "El destinatario no tiene correo." };
  return {
    body: {
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: input.from },
      subject: input.subject,
      content: [{ type: "text/plain", value: input.text }],
    },
  };
}

async function settings() {
  const row = await prismaProd.integrationSetting.findFirst({ where: { provider: "SENDGRID", companyId: null } });
  if (!row?.secretEnc) return null;
  const extra = row.extra ? JSON.parse(row.extra) as { fromEmail?: string } : {};
  return { secret: decryptSecret(row.secretEnc), fromEmail: extra.fromEmail ?? "" };
}

export async function verifySendGrid(secret: string) {
  if (!secret.startsWith("SG.")) return { ok: false, message: "La llave de SendGrid empieza con SG." };
  const response = await fetch("https://api.sendgrid.com/v3/scopes", { headers: { Authorization: `Bearer ${secret}` } });
  if (!response.ok) return { ok: false, message: "SendGrid rechazó la llave." };
  return { ok: true, message: "La llave puede consultar la cuenta. El remitente tiene que estar verificado en SendGrid." };
}

export async function sendMail(input: { to: string; subject: string; text: string }) {
  if (await inSandbox()) return { ok: false, message: "PRUEBA / SIN VALIDEZ. No se envió correo." };
  const config = await settings();
  if (!config) return { ok: false, message: "SendGrid no está configurado. No se envió correo." };
  const payload = sendgridBody({ from: config.fromEmail, to: input.to, subject: input.subject, text: input.text });
  if ("error" in payload && payload.error) return { ok: false, message: payload.error };
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload.body),
  });
  if (response.status === 202) return { ok: true, message: "Correo enviado." };
  const detail = await response.text();
  return { ok: false, message: detail || "SendGrid no entregó el correo. La operación principal no se revirtió." };
}
