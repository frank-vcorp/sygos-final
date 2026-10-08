import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diagnosisPresolicitudEditable, fieldPresolicitudOnly } from "./part-presolicitud";

describe("presolicitudes de refacción en diagnóstico", () => {
  it("marca técnico y supervisor como solo presolicitud", () => {
    assert.equal(fieldPresolicitudOnly("TECNICO"), true);
    assert.equal(fieldPresolicitudOnly("SUPERVISOR_TECNICO"), true);
    assert.equal(fieldPresolicitudOnly("GERENTE_OPERATIVO_SYSTRON"), false);
  });

  it("permite editar solo mientras el diagnóstico está en ejecución", () => {
    assert.equal(diagnosisPresolicitudEditable("EN_DIAGNOSTICO"), true);
    assert.equal(diagnosisPresolicitudEditable("DEVUELTO"), true);
    assert.equal(diagnosisPresolicitudEditable("PENDIENTE_VALIDACION"), false);
    assert.equal(diagnosisPresolicitudEditable("VALIDADO"), false);
  });
});
