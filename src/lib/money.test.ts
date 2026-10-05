import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finalFromBase, linesForTotal, quoteTotals } from "./money";

describe("cotización", () => {
  it("calcula IVA de 16% después del descuento y en MXN", () => {
    const totals = quoteTotals([{ quantity: 2, unitPrice: 1000 }], 10);
    assert.equal(totals?.subtotal, 2000);
    assert.equal(totals?.discount, 200);
    assert.equal(totals?.base, 1800);
    assert.equal(totals?.iva, 288);
    assert.equal(totals?.total, 2088);
  });

  it("aplica el incremento congelado y no publica la base", () => {
    assert.equal(finalFromBase(1000, 10), 1100);
  });

  it("no inventa un total si falta el precio", () => {
    assert.equal(quoteTotals([{ quantity: 1, unitPrice: null }], 0), null);
  });

  it("en una venta autorizada el total usa solo las líneas autorizadas", () => {
    const lines = [
      { quantity: 1, unitPrice: 18000, authorized: true },
      { quantity: 1, unitPrice: 9000, authorized: false },
    ];
    const chosen = linesForTotal(lines, "VENTA_EQUIPO", "AUTORIZADA");
    assert.equal(quoteTotals(chosen, 0)?.total, 20880);
  });
});