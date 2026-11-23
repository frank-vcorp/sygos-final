import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSortValues, receivableOverdueScore, sortRowsByColumn } from "./list-sort";

describe("list-sort", () => {
  it("ordena fechas ISO y objetos Date", () => {
    const rows = [
      { id: "b", at: "2024-06-02T12:00:00.000Z" },
      { id: "a", at: new Date("2024-06-01T12:00:00.000Z") },
    ];
    const sorted = sortRowsByColumn(rows, (r) => r.at, "asc");
    assert.equal(sorted[0]?.id, "a");
    assert.equal(sorted[1]?.id, "b");
  });

  it("ordena montos con formato", () => {
    assert.ok(compareSortValues("$1,200.50", "$899.00") > 0);
    assert.ok(compareSortValues("$100.00", "$50.00") > 0);
  });

  it("prioriza vencimiento en cobranza", () => {
    const now = Date.parse("2024-06-10T12:00:00.000Z");
    const old = receivableOverdueScore(100, "2024-06-01T12:00:00.000Z", now);
    const recent = receivableOverdueScore(100, "2024-06-09T12:00:00.000Z", now);
    assert.ok(old > recent);
    assert.equal(receivableOverdueScore(0, "2024-01-01T12:00:00.000Z", now), 0);
  });
});