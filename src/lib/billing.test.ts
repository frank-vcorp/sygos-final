import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cashAllowedOnInvoice } from "./billing";

describe("facturación", () => {
  it("bloquea efectivo de $2,000 o más cuando el cliente requiere factura", () => {
    assert.equal(cashAllowedOnInvoice(1999.99, true), true);
    assert.equal(cashAllowedOnInvoice(2000, true), false);
    assert.equal(cashAllowedOnInvoice(5000, false), true);
    assert.equal(cashAllowedOnInvoice(5000, null), true);
  });
});
