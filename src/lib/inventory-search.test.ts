import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPartSearchKey,
  INVENTORY_SEARCH_MIN_LEN,
  inventoryListHasCriteria,
  inventoryListHref,
  normalizeInventorySearch,
  partInventoryAvailableQty,
  partInventoryListWhere,
  partInventorySearchWhere,
  parseInventoryStockFilter,
} from "./inventory-search";

describe("búsqueda de inventario", () => {
  it("exige al menos dos caracteres para texto libre", () => {
    assert.equal(partInventorySearchWhere("co-1", "a"), null);
    assert.notEqual(partInventorySearchWhere("co-1", "ab"), null);
    assert.equal(INVENTORY_SEARCH_MIN_LEN, 2);
  });

  it("permite listar solo por familia sin texto", () => {
    assert.equal(inventoryListHasCriteria({ family: "FILTROS" }), true);
    const where = partInventoryListWhere("co-1", { family: "FILTROS" });
    assert.ok(where?.AND?.some((clause) => "family" in clause));
  });

  it("arma URL de filtros", () => {
    assert.equal(
      inventoryListHref({ family: "MOTORES", query: "bomba", stock: "disponible" }),
      "/inventario?q=bomba&familia=MOTORES&existencia=disponible",
    );
  });

  it("normaliza acentos para searchKey", () => {
    assert.equal(normalizeInventorySearch("Filtro Hidráulico"), "filtro hidraulico");
    const key = buildPartSearchKey({ partNumber: "ABC", description: "Módulo eléctrico" });
    assert.ok(key.includes("modulo"));
    assert.ok(!key.includes("é"));
  });

  it("interpreta vista legada bajo mínimo", () => {
    assert.equal(parseInventoryStockFilter("", "bajo_minimo"), "bajo_minimo");
  });

  it("calcula existencia disponible descontando apartados", () => {
    assert.equal(partInventoryAvailableQty({ qty: 10, qtyReserved: 3 }), 7);
  });
});
