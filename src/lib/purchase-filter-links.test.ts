import assert from "node:assert/strict";
import test from "node:test";
import { purchaseListHref, shoppingListHref } from "./purchase-filter-links";

test("canonicaliza filtros de compras y elimina valores vacíos", () => {
  assert.equal(
    purchaseListHref({
      vista: "compras",
      q: "  bomba  ",
      estado: "PENDIENTE_VALIDAR",
      fecha: "2026-10-27",
      categoria: " categoria-1 ",
      proveedor: " proveedor-1 ",
      solicitante: " usuario-1 ",
    }),
    "/compras?q=bomba&estado=PENDIENTE_VALIDAR&fecha=2026-10-27&categoria=categoria-1&proveedor=proveedor-1&solicitante=usuario-1",
  );
});

test("conserva la vista compartible y los filtros de listas", () => {
  assert.equal(
    purchaseListHref({ vista: "autorizar", q: "OC-42" }),
    "/compras?vista=autorizar&q=OC-42",
  );
  assert.equal(
    shoppingListHref({ estado: "TODAS", proveedor: " proveedor-1 ", fecha: "2026-10-27" }),
    "/compras/listas?proveedor=proveedor-1&fecha=2026-10-27",
  );
});
