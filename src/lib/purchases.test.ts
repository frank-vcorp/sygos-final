import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { purchaseConceptDefault, purchaseMovementDetails, requirementStatusAfter, requirementsNeedExpenseSelection, selectExpenseCatalog, shoppingListStatusFilter, shoppingListSupplierId, sourceRequirementIsDuplicate, withinDirectLimits } from "./purchases";

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

  it("conserva el proveedor de una lista existente", () => {
    assert.equal(shoppingListSupplierId("mouser", "otro-proveedor"), "mouser");
    assert.equal(shoppingListSupplierId(null, "mouser"), "mouser");
    assert.equal(shoppingListSupplierId(null), null);
  });

  it("muestra listas abiertas por defecto y acepta filtros de listas", () => {
    assert.equal(shoppingListStatusFilter(), "ABIERTA");
    assert.equal(shoppingListStatusFilter("CONVERTIDA"), "CONVERTIDA");
    assert.equal(shoppingListStatusFilter("TODAS"), undefined);
    assert.equal(shoppingListStatusFilter("EN_LISTA"), "ABIERTA");
  });

  it("solo pide clasificación financiera si la lista incluye generales", () => {
    assert.equal(requirementsNeedExpenseSelection(["REFACCION", "REFACCION"]), false);
    assert.equal(requirementsNeedExpenseSelection(["REFACCION", "GENERAL"]), true);
  });

  it("predetermina la descripción de refacciones sin reemplazar una descripción editada", () => {
    assert.equal(purchaseConceptDefault("REFACCION"), "Compra de refacciones y componentes");
    assert.equal(purchaseConceptDefault("REFACCION", " Refacciones para torno "), "Refacciones para torno");
    assert.equal(purchaseConceptDefault("GENERAL", "", "Mantenimiento correctivo"), "Mantenimiento correctivo");
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
