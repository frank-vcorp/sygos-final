import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  financeCatalogDeleteBlockedMessage,
  findFinanceCatalogSelection,
  visibleFinanceCatalog,
} from "./finance-catalog-ui";

const incomes = [
  { id: "in-servicios", name: "Servicios" },
  { id: "in-equipo", name: "Venta de equipo" },
];

const expenses = [
  {
    id: "cat-op",
    name: "Producción y operación",
    subcategories: [
      { id: "sub-ref", name: "Refacciones y componentes" },
      { id: "sub-her", name: "Herramientas" },
    ],
  },
  {
    id: "cat-fin",
    name: "Gastos financieros",
    subcategories: [{ id: "sub-int", name: "Intereses" }],
  },
  { id: "cat-vacia", name: "Sin subcategorías", subcategories: [] },
];

describe("catálogo financiero del CEO", () => {
  it("anida las subcategorías dentro de su categoría y no las deja como filas sueltas", () => {
    const visible = visibleFinanceCatalog({ incomes, expenses, q: "", tipo: "" });
    assert.deepEqual(visible.map((row) => row.clase), ["ingreso", "ingreso", "egreso", "egreso", "egreso"]);
    const operacion = visible.find((row) => row.id === "cat-op");
    assert.equal(operacion?.clase, "egreso");
    if (operacion?.clase !== "egreso") return;
    assert.deepEqual(operacion.subcategories.map((sub) => sub.name), ["Refacciones y componentes", "Herramientas"]);
    assert.equal(visible.some((row) => row.id === "sub-ref"), false);
  });

  it("filtra ingresos, egresos y subcategorías sin sacar la subcategoría de su padre", () => {
    assert.deepEqual(
      visibleFinanceCatalog({ incomes, expenses, q: "", tipo: "ingreso" }).map((row) => row.id),
      ["in-servicios", "in-equipo"],
    );
    const egresos = visibleFinanceCatalog({ incomes, expenses, q: "", tipo: "egreso" });
    assert.ok(egresos.every((row) => row.clase === "egreso"));
    const soloSub = visibleFinanceCatalog({ incomes, expenses, q: "", tipo: "sub" });
    assert.deepEqual(soloSub.map((row) => row.id), ["cat-op", "cat-fin"]);
    const refacciones = visibleFinanceCatalog({ incomes, expenses, q: "refacciones", tipo: "" });
    assert.deepEqual(refacciones.map((row) => row.id), ["cat-op"]);
    assert.equal(refacciones[0]?.clase, "egreso");
    if (refacciones[0]?.clase === "egreso") {
      assert.deepEqual(refacciones[0].subcategories.map((sub) => sub.id), ["sub-ref"]);
    }
    const produccion = visibleFinanceCatalog({ incomes, expenses, q: "producción", tipo: "egreso" });
    assert.equal(produccion.length, 1);
    if (produccion[0]?.clase === "egreso") assert.equal(produccion[0].subcategories.length, 2);
    assert.deepEqual(visibleFinanceCatalog({ incomes, expenses, q: "no-existe", tipo: "" }), []);
  });

  it("resuelve la selección de una subcategoría con la categoría padre", () => {
    assert.deepEqual(findFinanceCatalogSelection(incomes, expenses, "sub-ref", "sub"), {
      clase: "sub",
      id: "sub-ref",
      name: "Refacciones y componentes",
      categoryId: "cat-op",
    });
    assert.equal(findFinanceCatalogSelection(incomes, expenses, "cat-vacia", "egreso")?.clase, "egreso");
    assert.equal(findFinanceCatalogSelection(incomes, expenses, "falta", "ingreso"), null);
  });

  it("explica el bloqueo cuando el catálogo está en uso y no dice nada si se puede eliminar", () => {
    assert.equal(financeCatalogDeleteBlockedMessage("ingreso", "Servicios", { purchases: 0, movements: 0 }), null);
    assert.equal(
      financeCatalogDeleteBlockedMessage("ingreso", "Servicios", { purchases: 0, movements: 2 }),
      "No se puede eliminar la categoría de ingreso «Servicios»: está en uso en movimientos financieros.",
    );
    assert.equal(
      financeCatalogDeleteBlockedMessage("egreso", "Ventas", { purchases: 1, movements: 0 }),
      "No se puede eliminar la categoría de egreso «Ventas»: está en uso en compras.",
    );
    assert.match(
      financeCatalogDeleteBlockedMessage("sub", "Intereses", { purchases: 1, movements: 1 }) ?? "",
      /subcategoría «Intereses»: está en uso en compras y movimientos financieros/,
    );
  });
});
