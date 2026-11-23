import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeTechnicalLogs,
  technicalCaseIdsForMergedBitacora,
  technicalCaseKindLabel,
} from "./technical-log-merge";

describe("technical-log-merge", () => {
  it("technicalCaseKindLabel distingue DX y OS", () => {
    assert.equal(technicalCaseKindLabel("DIAGNOSTICO"), "Diagnóstico");
    assert.equal(technicalCaseKindLabel("DX"), "Diagnóstico");
    assert.equal(technicalCaseKindLabel("OS"), "Orden de servicio");
  });

  it("technicalCaseIdsForMergedBitacora incluye padre DX al ver OS", () => {
    const ids = technicalCaseIdsForMergedBitacora(
      { id: "os-1", kind: "OS", spawnedFromId: "dx-1" },
      [{ id: "dx-1", kind: "DIAGNOSTICO", spawnedFromId: null }],
    );
    assert.deepEqual([...ids].sort(), ["dx-1", "os-1"]);
  });

  it("technicalCaseIdsForMergedBitacora incluye OS hijo al ver DX", () => {
    const ids = technicalCaseIdsForMergedBitacora(
      { id: "dx-1", kind: "DIAGNOSTICO", spawnedFromId: null },
      [{ id: "os-1", kind: "OS", spawnedFromId: "dx-1" }],
    );
    assert.deepEqual([...ids].sort(), ["dx-1", "os-1"]);
  });

  it("mergeTechnicalLogs ordena por createdAt y etiqueta por caso", () => {
    const cases = [
      { id: "dx-1", folio: "DX-100", kind: "DIAGNOSTICO" },
      { id: "os-1", folio: "OS-200", kind: "OS" },
    ];
    const logs = [
      {
        id: "l2",
        caseId: "os-1",
        body: "Reparación",
        authorUserId: "u1",
        createdAt: new Date("2026-01-02T10:00:00Z"),
      },
      {
        id: "l1",
        caseId: "dx-1",
        body: "Hallazgo",
        authorUserId: "u2",
        createdAt: new Date("2026-01-01T10:00:00Z"),
      },
    ];
    const merged = mergeTechnicalLogs("os-1", cases, logs);
    assert.equal(merged.length, 2);
    assert.equal(merged[0].body, "Hallazgo");
    assert.equal(merged[0].caseKindLabel, "Diagnóstico");
    assert.equal(merged[0].caseFolio, "DX-100");
    assert.equal(merged[1].body, "Reparación");
    assert.equal(merged[1].caseKindLabel, "Orden de servicio");
    assert.equal(merged[1].fromCurrentCase, true);
    assert.equal(merged[0].fromCurrentCase, false);
  });
});