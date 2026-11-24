import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billingSalesCanViewBillingDetail,
  billingSalesDetailReadOnly,
  billingSalesListDetailHref,
} from "./billing-sales";

describe("billing-sales", () => {
  it("VENTAS no abre detalle de documentos SOLICITADA", () => {
    const id = "doc-1";
    assert.equal(billingSalesListDetailHref("VENTAS", { id, status: "SOLICITADA" }), null);
    assert.equal(billingSalesCanViewBillingDetail("VENTAS", { status: "SOLICITADA" }), false);
  });

  it("VENTAS abre detalle de documentos emitidos o cancelados", () => {
    const id = "doc-2";
    assert.equal(billingSalesListDetailHref("VENTAS", { id, status: "EMITIDA" }), `/facturacion/${id}`);
    assert.equal(billingSalesListDetailHref("VENTAS", { id, status: "CANCELADA" }), `/facturacion/${id}`);
    assert.equal(billingSalesCanViewBillingDetail("VENTAS", { status: "EMITIDA" }), true);
    assert.equal(billingSalesCanViewBillingDetail("VENTAS", { status: "CANCELADA" }), true);
  });

  it("Otros roles conservan acceso y mutación", () => {
    const id = "doc-3";
    assert.equal(billingSalesListDetailHref("COORDINACION_ADMINISTRACION", { id, status: "SOLICITADA" }), `/facturacion/${id}`);
    assert.equal(billingSalesCanViewBillingDetail("CEO", { status: "SOLICITADA" }), true);
    assert.equal(billingSalesDetailReadOnly("VENTAS"), true);
    assert.equal(billingSalesDetailReadOnly("CEO"), false);
  });
});