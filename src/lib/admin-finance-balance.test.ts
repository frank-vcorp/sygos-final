import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminAdjustmentNote, computeBalanceAdjustment } from "./admin-finance-balance";

describe("ajuste administrador de saldos", () => {
  it("calcula delta, dirección e importe del movimiento", () => {
    assert.deepEqual(computeBalanceAdjustment(50_000, 10_000), {
      current: 50_000,
      target: 10_000,
      delta: -40_000,
      direction: "EGRESO",
      amount: 40_000,
    });
    assert.deepEqual(computeBalanceAdjustment(0, 10_000), {
      current: 0,
      target: 10_000,
      delta: 10_000,
      direction: "INGRESO",
      amount: 10_000,
    });
    assert.equal(computeBalanceAdjustment(1234.5, 1234.5), null);
  });

  it("redondea a centavos", () => {
    const plan = computeBalanceAdjustment(100, 100.015);
    assert.equal(plan?.target, 100.02);
    assert.equal(plan?.direction, "INGRESO");
    assert.equal(plan?.amount, 0.02);
  });

  it("arma la nota de auditoría con motivo y saldos", () => {
    assert.match(adminAdjustmentNote("Saldo inicial demo", 0, 10_000), /Saldo inicial demo · Saldo \$0\.00 → \$10,000\.00/);
  });
});
