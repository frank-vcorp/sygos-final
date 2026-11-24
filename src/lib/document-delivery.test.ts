import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contactOptionsForDelivery,
  deliveryIntegrationFromConfig,
  documentPublicUrl,
  parseEmailRecipients,
  parsePhoneRecipients,
  summarizeMultiSend,
} from "./document-delivery-core";
import type { SendGridSmtpConfig } from "./sendgrid";
import type { WhatsAppState } from "./whatsapp";

describe("document-delivery", () => {
  it("parsea correos de checkboxes y campo adicional sin duplicar", () => {
    const form = new FormData();
    form.append("contactEmail", "A@Cliente.COM");
    form.append("contactEmail", "b@cliente.com");
    form.set("extraEmail", "c@otro.com, a@cliente.com");
    const list = parseEmailRecipients(form);
    assert.deepEqual(list.sort(), ["a@cliente.com", "b@cliente.com", "c@otro.com"]);
  });

  it("parsea teléfonos de checkboxes y adicionales", () => {
    const form = new FormData();
    form.append("contactPhone", "8112345678");
    form.set("extraPhone", "+52 81 9876 5432");
    const list = parsePhoneRecipients(form);
    assert.equal(list.length, 2);
    assert.ok(list.includes("8112345678"));
    assert.ok(list.includes("+52 81 9876 5432"));
  });

  it("resume envíos múltiples", () => {
    const allOk = summarizeMultiSend([
      { target: "a@b.com", ok: true, message: "ok" },
      { target: "c@d.com", ok: true, message: "ok" },
    ]);
    assert.equal(allOk.ok, true);
    assert.equal(allOk.sent, 2);

    const partial = summarizeMultiSend([
      { target: "a@b.com", ok: true, message: "ok" },
      { target: "bad", ok: false, message: "falló" },
    ]);
    assert.equal(partial.ok, true);
    assert.equal(partial.sent, 1);
    assert.equal(partial.failed, 1);
  });

  it("expone hints de integración SendGrid y WhatsApp", () => {
    const sendGrid = {
      enabled: false,
      host: "smtp.sendgrid.net",
      port: 587,
      username: "apikey",
      fromEmail: "a@b.com",
      fromName: "SYGOS",
      secret: "SG.x",
      secretHint: null,
      hasSecret: true,
      source: "db",
    } satisfies SendGridSmtpConfig;
    const wa = {
      enabled: true,
      state: "desconectado",
      statusLabel: "Desconectado",
      qr: null,
      detail: "",
      defaultCountryCode: "52",
      linkedPhone: null,
      linkedName: null,
      hasSavedSession: false,
      updatedAt: new Date().toISOString(),
    } satisfies WhatsAppState;
    const hints = deliveryIntegrationFromConfig(sendGrid, wa);
    assert.equal(hints.email.ready, false);
    assert.equal(hints.whatsapp.ready, false);
  });

  it("arma opciones de contacto para la UI", () => {
    const options = contactOptionsForDelivery([
      { id: "1", name: "Ana", email: " ana@test.com ", phone: null, isPrimary: true },
    ]);
    assert.equal(options[0]?.email, "ana@test.com");
  });

  it("arma URL pública cuando APP_URL existe", () => {
    const prev = process.env.APP_URL;
    process.env.APP_URL = "https://erp.ejemplo.com/";
    assert.equal(documentPublicUrl("/documentos/cotizacion/abc"), "https://erp.ejemplo.com/documentos/cotizacion/abc");
    process.env.APP_URL = prev;
  });
});