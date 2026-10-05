import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addBusinessDays, compareBySla, warrantyDeadline } from "./sla";

describe("SLA", () => {
  it("salta sábado y domingo y conserva la hora de ingreso", () => {
    const friday = new Date("2026-10-02T15:30:00-06:00");
    const due = addBusinessDays(friday, 1);
    assert.equal(due.toISOString(), new Date("2026-10-05T15:30:00-06:00").toISOString());
  });

  it("ordena vencidos, luego el plazo más cercano y al final el ingreso más antiguo", () => {
    const now = new Date("2026-10-05T12:00:00-06:00").getTime();
    const rows = [
      { id: "nuevo", slaDueAt: new Date("2026-10-08T12:00:00-06:00"), slaStartedAt: new Date("2026-10-04T12:00:00-06:00"), createdAt: new Date("2026-10-04T12:00:00-06:00") },
      { id: "vencido", slaDueAt: new Date("2026-10-01T12:00:00-06:00"), slaStartedAt: new Date("2026-09-20T12:00:00-06:00"), createdAt: new Date("2026-09-20T12:00:00-06:00") },
      { id: "cerca", slaDueAt: new Date("2026-10-06T12:00:00-06:00"), slaStartedAt: new Date("2026-10-01T12:00:00-06:00"), createdAt: new Date("2026-10-01T12:00:00-06:00") },
    ].sort((a, b) => compareBySla(a, b, now));
    assert.deepEqual(rows.map((row) => row.id), ["vencido", "cerca", "nuevo"]);
  });

  it("cuenta seis meses desde la salida física", () => {
    const exit = new Date("2026-01-15T10:00:00-06:00");
    assert.equal(warrantyDeadline(exit).toISOString(), new Date("2026-07-15T10:00:00-06:00").toISOString());
  });
});