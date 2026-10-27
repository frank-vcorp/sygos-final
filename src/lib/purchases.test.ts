import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purchaseMovementDetails, requirementStatusAfter, selectExpenseCatalog, sourceRequirementIsDuplicate, withinDirectLimits } from "./purchases";

describe("compra directa", () => {
  it("exige límite individual y presupuesto del mes al mismo tiempo", () => {
    assert.equal(withinDirectLimits(2000, 3000, 2000, 5000), true);
    assert.equal(withinDirectLimits(2001, 0, 2000, 5000), false);
    assert.equal(withinDirectLimits(1500, 4000, 2000, 5000), false);
    assert.equal(withinDirectLimits(0, 0, 2000, 5000), false);
  });
});

describe("transiciones de requerimientos y listas", () => {
  it("mantiene los estados de compra directa y lista", () => {
    assert.equal(requirementStatusAfter("ADD_TO_LIST"), "EN_LISTA");
    assert.equal(requirementStatusAfter("REMOVE_FROM_LIST"), "PENDIENTE");
    assert.equal(requirementStatusAfter("BUY"), "ATENDIDO");
  });

  it("evita volver a importar el mismo origen técnico", () => {
    assert.equal(sourceRequirementIsDuplicate(null), false);
    assert.equal(sourceRequirementIsDuplicate({ id: "req-1" }), true);
  });
});

describe("catálogos financieros de compras", () => {
  const category = {
    id: "cat-operacion",
    name: "Producción y operación",
    subcategories: [{ id: "sub-refacciones", name: "Refacciones y componentes" }],
  };

  it("valida que la subcategoría pertenezca a la categoría elegida", () => {
    assert.deepEqual(selectExpenseCatalog(category, "sub-refacciones"), {
      expenseCategoryId: "cat-operacion",
      expenseCategory: "Producción y operación",
      expenseSubcategoryId: "sub-refacciones",
      expenseSubcategory: "Refacciones y componentes",
    });
    assert.throws(() => selectExpenseCatalog(category, "sub-ajena"), /no pertenece/);
  });

  it("propaga categoría, subcategoría y descripción al movimiento financiero", () => {
    assert.deepEqual(
      purchaseMovementDetails({
        expenseCategory: "Producción y operación",
        expenseSubcategory: "Refacciones y componentes",
        concept: "Rodamiento para torno",
      }),
      { category: "Producción y operación · Refacciones y componentes", note: "Rodamiento para torno" },
    );
  });
});
