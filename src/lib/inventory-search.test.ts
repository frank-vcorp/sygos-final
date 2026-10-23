import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPartSearchKey,
  INVENTORY_SEARCH_MIN_LEN,
  normalizeInventorySearch,
  partInventoryAvailableQty,
  partInventorySearchWhere,
} from "./inventory-search";

describe("búsqueda de inventario", () => {
  it("exige al menos dos caracteres", () => {
    assert.equal(partInventorySearchWhere("co-1", "a"), null);
    assert.notEqual(partInventorySearchWhere("co-1", "ab"), null);
    assert.equal(INVENTORY_SEARCH_MIN_LEN, 2);
  });

  it("normaliza acentos para searchKey", () => {
    assert.equal(normalizeInventorySearch("Filtro Hidráulico"), "filtro hidraulico");
    const key = buildPartSearchKey({ partNumber: "ABC", description: "Módulo eléctrico" });
    assert.ok(key.includes("modulo"));
    assert.ok(!key.includes("é"));
  });

  it("filtra por searchKey normalizado", () => {
    const where = partInventorySearchWhere("co-1", "hidraulico");
    assert.ok(where?.OR?.some((clause) => "searchKey" in clause));
  });

  it("calcula existencia disponible descontando apartados", () => {
    assert.equal(partInventoryAvailableQty({ qty: 10, qtyReserved: 3 }), 7);
  });
});
