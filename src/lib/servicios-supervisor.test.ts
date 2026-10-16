import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HISTORIAL_CASE, openOperationCaseWhere, technicianActiveCaseWhere, TECHNICIAN_HANDOFF_CASE } from "./servicios-supervisor";

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

describe("technicianActiveCaseWhere", () => {
  it("excluye cierres técnicos y pendiente de validación del gerente", () => {
    const where = technicianActiveCaseWhere("tec-1");
    assert.equal(where.assigneeUserId, "tec-1");
    for (const status of TECHNICIAN_HANDOFF_CASE) {
      assert.ok(where.status.notIn.includes(status));
    }
    assert.ok(where.status.notIn.includes("TERMINADA"));
    assert.ok(!where.status.notIn.includes("EN_REPARACION"));
  });
});
