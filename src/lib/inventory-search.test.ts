import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { INVENTORY_SEARCH_MIN_LEN, partInventoryAvailableQty, partInventorySearchWhere } from "./inventory-search";

describe("búsqueda de inventario", () => {
  it("exige al menos dos caracteres", () => {
    assert.equal(partInventorySearchWhere("co-1", "a"), null);
    assert.notEqual(partInventorySearchWhere("co-1", "ab"), null);
    assert.equal(INVENTORY_SEARCH_MIN_LEN, 2);
  });

  it("busca en producto, descripción y familia", () => {
    const where = partInventorySearchWhere("co-1", "filtro");
    assert.equal(where?.companyId, "co-1");
    assert.ok(where?.OR?.some((clause) => "partNumber" in clause));
    assert.ok(where?.OR?.some((clause) => "description" in clause));
    assert.ok(where?.OR?.some((clause) => "family" in clause));
  });

  it("calcula existencia disponible descontando apartados", () => {
    assert.equal(partInventoryAvailableQty({ qty: 10, qtyReserved: 3 }), 7);
  });
});
