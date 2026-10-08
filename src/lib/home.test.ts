import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homePath } from "./home";

describe("homePath", () => {
  it("envía cada perfil a su pantalla de inicio, no a /inicio", () => {
    assert.equal(homePath("VENTAS", "SYSTRON"), "/panel");
    assert.equal(homePath("CEO", "SYSTRON"), "/panel");
    assert.equal(homePath("COORDINACION_ADMINISTRACION", "SYSTRON"), "/panel");
    assert.equal(homePath("GERENTE_OPERATIVO_SYSTRON", "SYSTRON"), "/panel");
    assert.equal(homePath("TECNICO", "SYSTRON"), "/panel");
    assert.equal(homePath("ALMACEN", "SYSTRON"), "/custodia");
    assert.equal(homePath("KIOSCO_ASISTENCIA", "SYSTRON"), "/kiosco");
    assert.notEqual(homePath("ADMINISTRADOR", "SYSTRON"), "/inicio");
  });
});
