import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HISTORIAL_CASE, openOperationCaseWhere, pickBestQuoteForBandeja, technicianActiveCaseWhere, TECHNICIAN_HANDOFF_CASE } from "./servicios-supervisor";

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

describe("pickBestQuoteForBandeja", () => {
  it("prioriza PENDIENTE_DECISION sobre cotizaciones más recientes sin precio", () => {
    const older = {
      id: "q1",
      folio: "COT-2",
      technicalCaseId: "case-1",
      equipmentId: "eq-1",
      status: "PENDIENTE_DECISION",
      quoteType: "DIAGNOSTICO",
      discountPct: 0,
      updatedAt: new Date("2026-01-01"),
      sellerUserId: "seller-1",
      lines: [{ quantity: 1, unitPrice: 500, authorized: false }],
    };
    const newer = {
      ...older,
      id: "q2",
      folio: "COTDX-9",
      status: "PENDIENTE_COTIZAR",
      updatedAt: new Date("2026-02-01"),
      technicalCaseId: null,
    };
    const picked = pickBestQuoteForBandeja([newer, older]);
    assert.equal(picked?.id, "q1");
  });
});

describe("technicianActiveCaseWhere", () => {
  it("excluye cierres técnicos y pendiente de validación del gerente", () => {
    const where = technicianActiveCaseWhere("tec-1");
    assert.equal(where.assigneeUserId, "tec-1");
    const excluded = where.status.notIn as readonly string[];
    for (const status of TECHNICIAN_HANDOFF_CASE) {
      assert.ok(excluded.includes(status));
    }
    assert.ok(excluded.includes("TERMINADA"));
    assert.ok(!excluded.includes("EN_REPARACION"));
  });
});
