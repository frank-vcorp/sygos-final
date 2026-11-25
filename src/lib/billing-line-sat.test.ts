import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertBillingDocumentSatKeysForFiscal,
  billingDocumentSatKeysComplete,
  billingLineHasCompleteSatKeys,
  billingLineSatKeysEditable,
  BILLING_SAT_KEYS_ISSUE_ERROR,
  parseSatProductKey,
  parseSatUnitKey,
  resolveSatUnitName,
} from "./billing-line-sat";

describe("claves SAT en líneas de facturación", () => {
  it("permite editar antes del timbrado", () => {
    assert.equal(
      billingLineSatKeysEditable({ status: "SOLICITADA", kind: "FACTURA", fiscalStatus: "PENDIENTE" }),
      true,
    );
    assert.equal(
      billingLineSatKeysEditable({ status: "EMITIDA", kind: "FACTURA", fiscalStatus: "PENDIENTE" }),
      true,
    );
    assert.equal(
      billingLineSatKeysEditable({ status: "EMITIDA", kind: "FACTURA", fiscalStatus: "ERROR" }),
      true,
    );
    assert.equal(
      billingLineSatKeysEditable({ status: "EMITIDA", kind: "FACTURA", fiscalStatus: "TIMBRADA" }),
      false,
    );
    assert.equal(
      billingLineSatKeysEditable({ status: "SOLICITADA", kind: "REMISION", fiscalStatus: "NO_APLICA" }),
      false,
    );
  });

  it("valida clave producto de 8 dígitos", () => {
    assert.equal(parseSatProductKey("72154000"), "72154000");
    assert.throws(() => parseSatProductKey("7215400"), /8 dígitos/);
    assert.throws(() => parseSatProductKey(""), /8 dígitos/);
  });

  it("valida clave unidad no vacía y resuelve nombre", () => {
    assert.equal(parseSatUnitKey("e48"), "E48");
    assert.throws(() => parseSatUnitKey("   "), /obligatoria/);
    assert.equal(resolveSatUnitName("H87"), "Pieza");
  });

  it("exige claves completas para emitir facturas con CFDI", () => {
    const incomplete = { satProductKey: null, satUnitKey: null };
    const lineOk = { satProductKey: "32151700", satUnitKey: "H87" };
    assert.equal(billingLineHasCompleteSatKeys(incomplete), false);
    assert.equal(billingLineHasCompleteSatKeys({ satProductKey: "3215170", satUnitKey: "H87" }), false);
    assert.equal(billingLineHasCompleteSatKeys({ satProductKey: "32151700", satUnitKey: "" }), false);
    assert.equal(billingLineHasCompleteSatKeys(lineOk), true);
    assert.equal(
      billingDocumentSatKeysComplete({ kind: "FACTURA", lines: [incomplete] }),
      false,
    );
    assert.equal(billingDocumentSatKeysComplete({ kind: "REMISION", lines: [incomplete] }), true);
    assert.throws(
      () => assertBillingDocumentSatKeysForFiscal({ kind: "FACTURA", lines: [incomplete] }),
      (error: Error) => error.message === BILLING_SAT_KEYS_ISSUE_ERROR,
    );
    assert.doesNotThrow(() =>
      assertBillingDocumentSatKeysForFiscal({ kind: "FACTURA", lines: [lineOk] }),
    );
  });
});