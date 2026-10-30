import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptSecret, encryptSecret, secretHint } from "./crypto";
import { facturapiMode, invoicePayload } from "./facturapi";
import {
  DEFAULT_SMTP_HOST,
  DEFAULT_SMTP_PORT,
  DEFAULT_SMTP_USERNAME,
  formatFromHeader,
  normalizeSmtpPort,
  parseSendGridExtra,
  sendgridBody,
  serializeSendGridExtra,
} from "./sendgrid";
import {
  buildWhatsAppFallbackUrl,
  extractPhoneFromJid,
  formatWhatsAppPhone,
  parseWhatsAppExtra,
} from "./whatsapp";

describe("integraciones", () => {
  it("distingue la llave de pruebas y la de producción de Facturapi", () => {
    assert.equal(facturapiMode("sk_test_abc"), "test");
    assert.equal(facturapiMode("sk_live_abc"), "live");
    assert.equal(facturapiMode("otra"), null);
  });

  it("arma la factura de ingreso y señala el dato fiscal que falta", () => {
    const missing = invoicePayload({
      externalId: "1",
      customerName: "Cliente",
      rfc: null,
      taxSystem: "601",
      cfdiUse: "G03",
      paymentMethod: "PUE",
      zip: "64000",
      email: null,
      lines: [{ concept: "Servicio", quantity: 1, unitPrice: 100 }],
      iva: 16,
    });
    assert.equal("error" in missing, true);
    const ready = invoicePayload({
      externalId: "1",
      customerName: "Cliente",
      rfc: "XAXX010101000",
      taxSystem: "601",
      cfdiUse: "G03",
      paymentMethod: "PPD",
      zip: "64000",
      email: "a@b.com",
      lines: [{ concept: "Servicio", quantity: 1, unitPrice: 100 }],
      iva: 16,
    });
    assert.equal(ready.body?.use, "G03");
    assert.equal(ready.body?.payment_method, "PPD");
    assert.equal(ready.body?.payment_form, "99");
  });

  it("exige remitente y destinatario para SendGrid", () => {
    assert.equal("error" in sendgridBody({ from: "", to: "a@b.com", subject: "Hola", text: "Texto" }), true);
    const ready = sendgridBody({
      from: "facturas@systron.mx",
      fromName: "SYSTRON",
      to: "a@b.com",
      subject: "Hola",
      text: "Texto",
    });
    assert.equal(ready.body?.from.email, "facturas@systron.mx");
    assert.equal(ready.body?.from.name, "SYSTRON");
  });

  it("aplica valores por defecto de SendGrid SMTP Relay y soporta puertos 587, 465 y 25", () => {
    const defaults = parseSendGridExtra(null, "SYSTRON");
    assert.equal(defaults.enabled, true);
    assert.equal(defaults.host, DEFAULT_SMTP_HOST);
    assert.equal(defaults.port, DEFAULT_SMTP_PORT);
    assert.equal(defaults.username, DEFAULT_SMTP_USERNAME);
    assert.equal(defaults.fromName, "SYSTRON");

    assert.equal(normalizeSmtpPort(587), 587);
    assert.equal(normalizeSmtpPort("465"), 465);
    assert.equal(normalizeSmtpPort(25), 25);
    assert.equal(normalizeSmtpPort(9999), 587);

    const serialized = serializeSendGridExtra({
      enabled: false,
      host: "smtp.sendgrid.net",
      port: 465,
      username: "apikey",
      fromEmail: "avisos@systron.mx",
      fromName: "SYSTRON Alertas",
    });
    const parsed = parseSendGridExtra(serialized);
    assert.equal(parsed.enabled, false);
    assert.equal(parsed.port, 465);
    assert.equal(parsed.fromEmail, "avisos@systron.mx");
    assert.equal(parsed.fromName, "SYSTRON Alertas");
    assert.equal(formatFromHeader("avisos@systron.mx", "SYSTRON Alertas"), '"SYSTRON Alertas" <avisos@systron.mx>');
  });

  it("normaliza teléfonos, JIDs y enlaces de respaldo para WhatsApp (Baileys)", () => {
    assert.equal(formatWhatsAppPhone("81 1234 5678", "52"), "528112345678");
    assert.equal(formatWhatsAppPhone("+52 1 811 234 5678", "52"), "5218112345678");
    assert.equal(extractPhoneFromJid("5218112345678:14@s.whatsapp.net"), "+5218112345678");
    assert.equal(
      buildWhatsAppFallbackUrl("8112345678", "Hola SYGOS", "52"),
      "https://wa.me/528112345678?text=Hola%20SYGOS",
    );
    const waConfig = parseWhatsAppExtra(JSON.stringify({ enabled: true, defaultCountryCode: "+52", linkedPhone: "+528112345678" }));
    assert.equal(waConfig.enabled, true);
    assert.equal(waConfig.defaultCountryCode, "52");
    assert.equal(waConfig.linkedPhone, "+528112345678");
  });

  it("cifra y descifra llaves de integraciones sin requerir secretos hardcodeados", () => {
    const rawKey = "SG.test_api_key_123456";
    const encrypted = encryptSecret(rawKey);
    assert.equal(decryptSecret(encrypted), rawKey);
    assert.equal(secretHint(rawKey), "••••3456");
  });
});
