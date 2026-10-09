import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HISTORIAL_CASE, openOperationCaseWhere } from "./servicios-supervisor";

describe("openOperationCaseWhere", () => {
  it("mantiene operación abierta y diagnósticos validados con cotización pendiente", () => {
    const where = openOperationCaseWhere();
    assert.ok(where.OR);
    assert.deepEqual(where.OR[0], { status: { notIn: ["VALIDADO", "TERMINADA", "SIN_REPARACION"] } });
    assert.deepEqual(where.OR[1], { status: "VALIDADO", quotePending: true });
  });

  it("el historial sigue incluyendo VALIDADO", () => {
    assert.ok(HISTORIAL_CASE.includes("VALIDADO"));
  });
});
