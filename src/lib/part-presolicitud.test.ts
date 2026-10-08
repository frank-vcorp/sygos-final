import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diagnosisPresolicitudEditable } from "./part-presolicitud";

describe("presolicitudes de refacción en diagnóstico", () => {
  it("permite editar solo mientras el diagnóstico está en ejecución", () => {
    assert.equal(diagnosisPresolicitudEditable("EN_DIAGNOSTICO"), true);
    assert.equal(diagnosisPresolicitudEditable("DEVUELTO"), true);
    assert.equal(diagnosisPresolicitudEditable("PENDIENTE_VALIDACION"), false);
    assert.equal(diagnosisPresolicitudEditable("VALIDADO"), false);
  });
});
