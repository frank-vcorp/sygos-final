import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addBusinessDays, atMexicoCityLocal, compareBySla, formatSlaCountdown, normalizeSlaStartFromAuthorization, warrantyDeadline } from "./sla";

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

  it("prioriza filas express antes del resto del SLA", () => {
    const now = Date.now();
    const rows = [
      { id: "vencido", express: false, slaDueAt: new Date(0), slaStartedAt: new Date(0), createdAt: new Date(0) },
      { id: "express", express: true, slaDueAt: null, slaStartedAt: new Date(0), createdAt: new Date(0) },
    ].sort((a, b) => compareBySla(a, b, now));
    assert.deepEqual(rows.map((row) => row.id), ["express", "vencido"]);
  });

  it("formatea cuenta regresiva con reloj cuando queda menos de un día", () => {
    const now = new Date("2026-10-05T12:00:00-06:00").getTime();
    const due = new Date("2026-10-05T15:30:45-06:00");
    assert.equal(formatSlaCountdown(due, now).text, "3:30:45");
    assert.equal(formatSlaCountdown(due, now).overdue, false);
  });

  it("formatea días y horas cuando el plazo es lejano", () => {
    const now = new Date("2026-10-05T12:00:00-06:00").getTime();
    const due = new Date("2026-10-08T12:00:00-06:00");
    assert.equal(formatSlaCountdown(due, now).text, "3 d 0 h");
  });

  it("indica tiempo vencido", () => {
    const now = new Date("2026-10-05T12:00:00-06:00").getTime();
    const due = new Date("2026-10-03T10:00:00-06:00");
    assert.equal(formatSlaCountdown(due, now).overdue, true);
    assert.match(formatSlaCountdown(due, now).text, /^Hace /);
  });

  it("cuenta seis meses desde la salida física", () => {
    const exit = new Date("2026-01-15T10:00:00-06:00");
    assert.equal(warrantyDeadline(exit).toISOString(), new Date("2026-07-15T10:00:00-06:00").toISOString());
  });

  it("conserva la autorización en horario hábil", () => {
    const captured = new Date("2026-10-02T15:30:00-06:00");
    assert.equal(normalizeSlaStartFromAuthorization(captured).toISOString(), captured.toISOString());
  });

  it("mueve autorización vespertina al siguiente día hábil a las 8:00", () => {
    const captured = new Date("2026-10-02T19:00:00-06:00");
    const expected = atMexicoCityLocal(2026, 10, 5, 8);
    assert.equal(normalizeSlaStartFromAuthorization(captured).toISOString(), expected.toISOString());
  });

  it("mueve autorización antes de las 8:00 al mismo día hábil a las 8:00", () => {
    const captured = new Date("2026-10-05T07:15:00-06:00");
    const expected = atMexicoCityLocal(2026, 10, 5, 8);
    assert.equal(normalizeSlaStartFromAuthorization(captured).toISOString(), expected.toISOString());
  });

  it("mueve autorización en fin de semana al lunes a las 8:00", () => {
    const captured = new Date("2026-10-03T11:00:00-06:00");
    const expected = atMexicoCityLocal(2026, 10, 5, 8);
    assert.equal(normalizeSlaStartFromAuthorization(captured).toISOString(), expected.toISOString());
  });
});