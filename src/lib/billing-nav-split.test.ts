import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFacturacionVista, whereForFacturacionVista } from "./billing-documents-list-data";
import { billingListBackHref, billingUsesSplitRemisionesNav } from "./billing-nav-split";

describe("billingUsesSplitRemisionesNav", () => {
  it("solo aplica a Coordinación y CEO", () => {
    assert.equal(billingUsesSplitRemisionesNav("COORDINACION_ADMINISTRACION"), true);
    assert.equal(billingUsesSplitRemisionesNav("CEO"), true);
    assert.equal(billingUsesSplitRemisionesNav("VENTAS"), false);
    assert.equal(billingUsesSplitRemisionesNav("ADMINISTRADOR"), false);
  });
});

describe("billingListBackHref", () => {
  it("devuelve lista de remisiones para REMISION en Coord/CEO", () => {
    assert.deepEqual(billingListBackHref("CEO", "REMISION"), { href: "/remisiones", label: "Remisiones" });
    assert.deepEqual(billingListBackHref("VENTAS", "REMISION"), { href: "/facturacion", label: "Facturación" });
  });
});

describe("parseFacturacionVista", () => {
  it("omite todas y remisiones en nav dividido", () => {
    assert.equal(parseFacturacionVista(undefined, true), "facturas");
    assert.equal(parseFacturacionVista("remisiones", true), "remisiones");
    assert.equal(parseFacturacionVista(undefined, false), "todas");
  });
});

describe("whereForFacturacionVista", () => {
  it("excluye remisiones en solicitudes y canceladas con nav dividido", () => {
    assert.deepEqual(whereForFacturacionVista("solicitudes", true), { status: "SOLICITADA", kind: { not: "REMISION" } });
    assert.deepEqual(whereForFacturacionVista("todas", true), { kind: { not: "REMISION" } });
    assert.deepEqual(whereForFacturacionVista("solicitudes", false), { status: "SOLICITADA" });
  });
});