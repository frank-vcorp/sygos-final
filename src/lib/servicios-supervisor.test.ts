import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterQuotesPreferDiagnosisOverReservedOs,
  HISTORIAL_CASE,
  hiddenReservedOsStubCaseWhere,
  isHiddenReservedOsStubInDiagnosisCycle,
  openOperationCaseWhere,
  pickBestQuoteForBandeja,
  pickQuoteForAttention,
  servicioCompanyScope,
  technicianActiveCaseWhere,
  TECHNICIAN_HANDOFF_CASE,
} from "./servicios-supervisor";

describe("servicioCompanyScope", () => {
  it("en Systron muestra motores de origen y esconde el taller ajeno cuando el rol no ve motores", () => {
    assert.deepEqual(servicioCompanyScope("sy", { hideMotors: true }), {
      serviceCompanyId: "sy",
      equipment: { kind: "EQUI" },
    });
    assert.deepEqual(servicioCompanyScope("sy", { originMotors: true, equipmentKind: "MOT" }), {
      equipment: { kind: "MOT", originCompanyId: "sy" },
    });
    const both = servicioCompanyScope("sy", { originMotors: true });
    assert.equal("OR" in both && Array.isArray(both.OR) ? both.OR.length : 0, 2);
  });
});

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

describe("isHiddenReservedOsStubInDiagnosisCycle", () => {
  const siblings = [
    { id: "dx-1", kind: "DIAGNOSTICO" },
    { id: "os-stub", kind: "OS" },
  ];

  it("oculta OS reservada con quotePending en atención DIAGNOSTICO", () => {
    assert.equal(
      isHiddenReservedOsStubInDiagnosisCycle(
        {
          kind: "OS",
          spawnedFromId: "dx-1",
          quotePending: true,
          attention: { attentionType: "DIAGNOSTICO" },
        },
        siblings,
      ),
      true,
    );
  });

  it("muestra OS cuando ya no está quotePending (reparación autorizada)", () => {
    assert.equal(
      isHiddenReservedOsStubInDiagnosisCycle(
        {
          kind: "OS",
          spawnedFromId: "dx-1",
          quotePending: false,
          attention: { attentionType: "DIAGNOSTICO" },
        },
        siblings,
      ),
      false,
    );
  });

  it("no oculta reparación express OS-first", () => {
    assert.equal(
      isHiddenReservedOsStubInDiagnosisCycle(
        {
          kind: "OS",
          spawnedFromId: "dx-1",
          quotePending: true,
          attention: { attentionType: "REPARACION" },
        },
        siblings,
      ),
      false,
    );
  });

  it("hiddenReservedOsStubCaseWhere excluye el stub en Prisma", () => {
    const where = hiddenReservedOsStubCaseWhere();
    assert.deepEqual(where.NOT.AND[0], { kind: "OS" });
    assert.deepEqual(where.NOT.AND[3], { attention: { attentionType: "DIAGNOSTICO" } });
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

describe("pickQuoteForAttention", () => {
  const cases = [
    { id: "dx-1", kind: "DIAGNOSTICO", spawnedFromId: null },
    { id: "os-stub", kind: "OS", spawnedFromId: "dx-1" },
  ];
  const quoteOnDx = {
    id: "q-dx",
    folio: "COT-5",
    technicalCaseId: "dx-1",
    equipmentId: "eq-1",
    status: "PENDIENTE_COTIZAR",
    quoteType: "DIAGNOSTICO",
    discountPct: 0,
    updatedAt: new Date("2026-01-02"),
    sellerUserId: "seller-1",
    lines: [{ quantity: 1, unitPrice: null, authorized: false }],
  };
  const quoteOnOs = {
    ...quoteOnDx,
    id: "q-os",
    folio: "COT-5",
    technicalCaseId: "os-stub",
    updatedAt: new Date("2026-01-03"),
  };

  it("prefiere cotización ligada al DX sobre OS reservado del ciclo", () => {
    const filtered = filterQuotesPreferDiagnosisOverReservedOs([quoteOnOs, quoteOnDx], cases);
    assert.deepEqual(filtered.map((q) => q.id), ["q-dx"]);
    const picked = pickQuoteForAttention("att-1", cases, "eq-1", [quoteOnOs, quoteOnDx]);
    assert.equal(picked?.id, "q-dx");
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
