import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billingLineSatKeysEditable,
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
});