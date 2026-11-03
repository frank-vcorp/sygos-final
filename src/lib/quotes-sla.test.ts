import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { repairOrderSlaDueAt } from "./quotes";

const diagnosisCase = { slaDueAt: new Date("2026-10-20T08:00:00-06:00") };

describe("SLA de OS desde cotización de reparación", () => {
  it("prioriza el plazo de la cotización de reparación autorizada", () => {
    const quoteDue = new Date("2026-11-10T08:00:00-06:00");
    const diagnosisDue = new Date("2026-11-01T08:00:00-06:00");
    assert.equal(
      repairOrderSlaDueAt({ slaDueAt: quoteDue }, { slaDueAt: diagnosisDue }, diagnosisCase)?.toISOString(),
      quoteDue.toISOString(),
    );
  });

  it("usa el plazo de la cotización de diagnóstico si no hay reparación", () => {
    const diagnosisQuoteDue = new Date("2026-11-05T08:00:00-06:00");
    assert.equal(
      repairOrderSlaDueAt(null, { slaDueAt: diagnosisQuoteDue }, diagnosisCase)?.toISOString(),
      diagnosisQuoteDue.toISOString(),
    );
  });

  it("usa el plazo del diagnóstico si la cotización no trae fecha", () => {
    const diagnosisDue = new Date("2026-11-01T08:00:00-06:00");
    assert.equal(
      repairOrderSlaDueAt(null, { slaDueAt: diagnosisDue }, { slaDueAt: diagnosisDue })?.toISOString(),
      diagnosisDue.toISOString(),
    );
    assert.equal(
      repairOrderSlaDueAt({ slaDueAt: null }, { slaDueAt: diagnosisDue }, { slaDueAt: diagnosisDue })?.toISOString(),
      diagnosisDue.toISOString(),
    );
  });
});
