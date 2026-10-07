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

  it("separa equipos, motores, almacén e inventario", () => {
    assert.equal(can("VENTAS", "equi.create", "SYSTRON"), true);
    assert.equal(can("VENTAS", "mot.create", "SYSTRON"), true);
    assert.equal(can("VENTAS", "mot.create", "SERVOMOTORES"), false);
    assert.equal(can("ALMACEN", "equi.view", "SYSTRON"), true);
    assert.equal(can("ALMACEN", "mot.view", "SYSTRON"), false);
    assert.equal(can("ALMACEN", "custody.confirm", "SYSTRON"), true);
    assert.equal(can("ALMACEN", "custody.confirm", "SERVOMOTORES"), false);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "mot.create", "SERVOMOTORES"), true);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "custody.confirm", "SERVOMOTORES"), true);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "equi.view", "SERVOMOTORES"), false);
    assert.equal(can("TECNICO", "inventory.operate", "SYSTRON"), false);
    assert.equal(can("ALMACEN", "inventory.operate", "SYSTRON"), true);
  });

  it("deja al ayudante y al kiosco fuera de los módulos de negocio", () => {
    assert.equal(can("AYUDANTE_GENERAL", "nav.business"), false);
    assert.equal(can("KIOSCO_ASISTENCIA", "nav.business"), false);
    assert.equal(can("ALMACEN", "nav.business"), true);
    assert.equal(can("ALMACEN", "client.create", "SYSTRON"), false);
  });

  it("mantiene a coordinación fuera de la operación técnica", () => {
    assert.equal(can("COORDINACION_ADMINISTRACION", "attention.catalog", "SYSTRON"), false);
    assert.equal(can("COORDINACION_ADMINISTRACION", "equipment.catalog", "SYSTRON"), false);
    assert.equal(can("COORDINACION_ADMINISTRACION", "operation.queue", "SYSTRON"), false);
  });

  it("deja al técnico fuera de bandejas de servicio y catálogo de equipos", () => {
    assert.equal(can("TECNICO", "attention.catalog", "SYSTRON"), false);
    assert.equal(can("TECNICO", "equipment.catalog", "SYSTRON"), false);
    assert.equal(can("VENTAS", "attention.catalog", "SYSTRON"), true);
    assert.equal(can("SUPERVISOR_TECNICO", "attention.catalog", "SYSTRON"), true);
    assert.equal(can("TECNICO", "panel.view", "SYSTRON"), true);
  });

  it("restringe el resumen de inicio a perfiles comerciales y directivos", () => {
    assert.equal(can("TECNICO", "home.summary", "SYSTRON"), false);
    assert.equal(can("SUPERVISOR_TECNICO", "home.summary", "SYSTRON"), false);
    assert.equal(can("ALMACEN", "home.summary", "SYSTRON"), false);
    assert.equal(can("VENTAS", "home.summary", "SYSTRON"), true);
    assert.equal(can("CEO", "home.summary", "SYSTRON"), true);
  });
});
