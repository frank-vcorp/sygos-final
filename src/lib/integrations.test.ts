import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { facturapiMode, invoicePayload } from "./facturapi";
import { sendgridBody } from "./sendgrid";

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
    const ready = sendgridBody({ from: "facturas@systron.mx", to: "a@b.com", subject: "Hola", text: "Texto" });
    assert.equal(ready.body?.from.email, "facturas@systron.mx");
  });
});
