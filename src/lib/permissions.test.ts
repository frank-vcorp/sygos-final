import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can, canSeeUser } from "./permissions";

describe("permisos de fase 1", () => {
  it("separa el alta de clientes por empresa", () => {
    assert.equal(can("VENTAS", "client.create", "SYSTRON"), true);
    assert.equal(can("VENTAS", "client.create", "SERVOMOTORES"), false);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "client.create", "SERVOMOTORES"), true);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "client.create", "SYSTRON"), false);
    assert.equal(can("TECNICO", "client.create", "SYSTRON"), false);
  });

  it("restringe búsqueda global y administradores", () => {
    assert.equal(can("CEO", "search.global"), true);
    assert.equal(can("ADMINISTRADOR", "search.global"), true);
    assert.equal(can("COORDINACION_ADMINISTRACION", "search.global"), false);
    assert.equal(can("VENTAS", "search.global"), false);
    assert.equal(canSeeUser("CEO", "ADMINISTRADOR"), false);
    assert.equal(canSeeUser("ADMINISTRADOR", "ADMINISTRADOR"), true);
    assert.equal(can("CEO", "user.manageAdmins"), false);
    assert.equal(can("ADMINISTRADOR", "config.integrations"), true);
    assert.equal(can("CEO", "config.integrations"), false);
  });

  it("deja al ayudante y al kiosco fuera de los módulos de negocio", () => {
    assert.equal(can("AYUDANTE_GENERAL", "nav.business"), false);
    assert.equal(can("KIOSCO_ASISTENCIA", "nav.business"), false);
    assert.equal(can("ALMACEN", "nav.business"), true);
    assert.equal(can("ALMACEN", "client.create", "SYSTRON"), false);
  });
});
