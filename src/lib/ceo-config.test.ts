import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMMERCIAL_GOAL_METRICS,
  GENERAL_MONTHLY_BUDGET_DEFAULT,
  PARTS_MONTHLY_BUDGET_DEFAULT,
  formatYearMonth,
  isCommercialGoalMetric,
  monthBounds,
  parseClabe,
  parseYearMonth,
} from "./ceo-config";

describe("configuración CEO", () => {
  it("deja solo facturación y cobranza como metas", () => {
    assert.deepEqual(COMMERCIAL_GOAL_METRICS.map((metric) => metric.id), ["FACTURACION", "COBRANZA"]);
    assert.equal(isCommercialGoalMetric("FACTURACION"), true);
    assert.equal(isCommercialGoalMetric("CLIENTES"), false);
  });

  it("usa los presupuestos mensuales iniciales de refacciones y generales", () => {
    assert.equal(PARTS_MONTHLY_BUDGET_DEFAULT, 100_000);
    assert.equal(GENERAL_MONTHLY_BUDGET_DEFAULT, 5_000);
  });

  it("interpreta el mes y la CLABE", () => {
    assert.deepEqual(parseYearMonth("2026-10"), { year: 2026, month: 10 });
    assert.equal(parseYearMonth("2026-13"), null);
    assert.equal(formatYearMonth(2026, 3), "2026-03");
    const bounds = monthBounds(2026, 10);
    assert.equal(bounds.start.toISOString(), "2026-10-01T06:00:00.000Z");
    assert.equal(bounds.end.toISOString(), "2026-11-01T06:00:00.000Z");
    assert.equal(parseClabe("012 180 001234567897"), "012180001234567897");
    assert.throws(() => parseClabe("123"), /18 dígitos/);
  });
});
