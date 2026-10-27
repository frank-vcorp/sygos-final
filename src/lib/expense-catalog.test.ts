import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reconcileExpenseSubcategoryId, subcategoriesForExpenseCategory } from "./expense-catalog";

const catalog = [
  {
    id: "cat-fin",
    name: "Gastos financieros",
    subcategories: [{ id: "sub-intereses", name: "Intereses" }],
  },
  {
    id: "cat-op",
    name: "Producción y operación",
    subcategories: [{ id: "sub-ref", name: "Refacciones y componentes" }],
  },
];

describe("expense-catalog", () => {
  it("devuelve subcategorías solo de la categoría seleccionada", () => {
    assert.deepEqual(subcategoriesForExpenseCategory(catalog, "cat-fin"), [{ id: "sub-intereses", name: "Intereses" }]);
    assert.deepEqual(subcategoriesForExpenseCategory(catalog, ""), []);
  });

  it("limpia subcategoría inválida al cambiar categoría", () => {
    assert.equal(reconcileExpenseSubcategoryId(catalog, "cat-fin", "sub-ref"), "");
    assert.equal(reconcileExpenseSubcategoryId(catalog, "cat-fin", "sub-intereses"), "sub-intereses");
  });
});
