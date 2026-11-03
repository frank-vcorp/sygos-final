import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dxNoRepairPickupSheetLabel,
  isNormalDiagnosisPriority,
  isPaidDiagnosisPriority,
} from "./diagnosis-no-repair";
import { administrativeStatus } from "./servicios-bandeja";

describe("diagnosis no repair priorities", () => {
  it("Normal por nombre o precio cero", () => {
    assert.equal(isNormalDiagnosisPriority("Normal", 3500), true);
    assert.equal(isNormalDiagnosisPriority("Alta", 0), true);
    assert.equal(isNormalDiagnosisPriority("Alta", null), true);
  });

  it("Alta y Exprés con precio congelado son de cobro", () => {
    assert.equal(isPaidDiagnosisPriority("Alta", 3500), true);
    assert.equal(isPaidDiagnosisPriority("Exprés", 4500), true);
    assert.equal(isPaidDiagnosisPriority("Normal", 0), false);
  });

  it("etiqueta de hoja de retiro incluye folio DX", () => {
    assert.equal(dxNoRepairPickupSheetLabel("DX-100"), "Hoja DX sin reparación · DX-100");
  });
});

describe("administrativeStatus DX sin reparación", () => {
  it("no muestra sin cotizar cuando el diagnóstico validado es sin reparación", () => {
    const row = administrativeStatus({
      attentionType: "DIAGNOSTICO",
      quoteStatus: null,
      quotePending: false,
      warrantyDecision: null,
      diagnosisNoRepair: true,
    });
    assert.equal(row.label, "DX sin reparación");
    assert.equal(row.tone, "ok");
  });
});
