import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { repairOrderSlaDueAt } from "./quotes";

describe("SLA de OS desde cotización de reparación", () => {
  it("prioriza el plazo de la cotización autorizada", () => {
    const quoteDue = new Date("2026-11-10T08:00:00-06:00");
    const diagnosisDue = new Date("2026-11-01T08:00:00-06:00");
    assert.equal(
      repairOrderSlaDueAt({ slaDueAt: quoteDue }, { slaDueAt: diagnosisDue })?.toISOString(),
      quoteDue.toISOString(),
    );
  });

  it("usa el plazo del diagnóstico si la cotización no trae fecha", () => {
    const diagnosisDue = new Date("2026-11-01T08:00:00-06:00");
    assert.equal(repairOrderSlaDueAt(null, { slaDueAt: diagnosisDue })?.toISOString(), diagnosisDue.toISOString());
    assert.equal(repairOrderSlaDueAt({ slaDueAt: null }, { slaDueAt: diagnosisDue })?.toISOString(), diagnosisDue.toISOString());
  });
});
