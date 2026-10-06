import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { absenceDiscount, bracketRate, laborProfile, overtimeAmount, overtimeBands, primaByWeek, splitBySalary, vacationDaysForSeniority, weekdaysBetween } from "./personnel";

describe("personal y nómina", () => {
  it("cuenta solo lunes a viernes y reparte la prima del 25% por semana", () => {
    const days = weekdaysBetween("2026-10-05", "2026-10-11");
    assert.deepEqual(days, ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]);
    const primas = primaByWeek(["2026-10-09", "2026-10-12"], 400, 100);
    assert.equal(primas.length, 2);
    assert.equal(primas[0].days, 1);
    assert.equal(primas[0].stamped, 100);
    assert.equal(primas[0].cash, 25);
    assert.equal(primas[1].weekStart, "2026-10-12");
  });

  it("parte las horas extra en doble hasta 9 y triple después", () => {
    const bands = overtimeBands(8, 3);
    assert.deepEqual(bands, { doubleHours: 1, tripleHours: 2 });
    const amount = overtimeAmount(1, 2, 100);
    assert.equal(amount, 800);
    assert.deepEqual(splitBySalary(800, 400, 100), { stamped: 640, cash: 160 });
  });

  it("descuenta la ausencia con 7/6 y deja al gerente de Servomotores fuera", () => {
    assert.equal(absenceDiscount(1, 600), 700);
    assert.equal(laborProfile("GERENTE_OPERATIVO_SERVOMOTORES").exempt, true);
    assert.equal(laborProfile("AYUDANTE_GENERAL").exempt, false);
    assert.equal(laborProfile("AYUDANTE_GENERAL").overtimeByManager, true);
    assert.equal(vacationDaysForSeniority(1), 12);
    assert.equal(vacationDaysForSeniority(6), 22);
  });

  it("aplica el intervalo de comisión a toda la facturación", () => {
    const brackets = [{ upTo: 100000, rate: 0.02 }, { upTo: null, rate: 0.03 }];
    assert.equal(bracketRate(80000, brackets), 0.02);
    assert.equal(bracketRate(150000, brackets), 0.03);
  });
});
