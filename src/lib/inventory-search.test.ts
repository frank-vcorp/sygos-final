import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPartSearchKey,
  INVENTORY_SEARCH_MIN_LEN,
  inventoryListHasCriteria,
  inventoryListHref,
  inventorySearchRelevance,
  normalizeInventorySearch,
  partInventoryAvailableQty,
  partInventoryListWhere,
  partInventorySearchWhere,
  parseInventoryStockFilter,
  sortInventorySearchResults,
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
    const and = where?.AND;
    const clauses = Array.isArray(and) ? and : and ? [and] : [];
    assert.ok(clauses.some((clause: Record<string, unknown>) => "family" in clause));
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

  it("prioriza producto que empieza con lo escrito", () => {
    const rows = sortInventorySearchResults(
      [
        {
          partNumber: "APT30GP60BDQ1G",
          description: "IGBT",
          family: "IGBT",
          catalogNumero: "44",
          rack: "2",
          nivel: "3",
        },
        {
          partNumber: "BTS409L1",
          description: "switch",
          family: "PWM",
          catalogNumero: "5",
          rack: "2",
          nivel: "5",
        },
      ],
      "BTS",
    );
    assert.equal(rows[0]?.partNumber, "BTS409L1");
    assert.equal(rows.length, 1);
  });
});
