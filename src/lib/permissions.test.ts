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
    assert.equal(can("ADMINISTRADOR", "config.company"), true);
    assert.equal(can("CEO", "config.integrations"), false);
    assert.equal(can("CEO", "config.company"), false);
    assert.equal(can("COORDINACION_ADMINISTRACION", "config.integrations"), false);
    assert.equal(can("COORDINACION_ADMINISTRACION", "config.company"), false);
  });

  it("separa equipos, motores, almacén e inventario", () => {
    assert.equal(can("VENTAS", "equi.create", "SYSTRON"), true);
    assert.equal(can("VENTAS", "mot.create", "SYSTRON"), true);
    assert.equal(can("VENTAS", "attention.create", "SYSTRON"), true);
    assert.equal(can("GERENTE_OPERATIVO_SYSTRON", "attention.create", "SYSTRON"), true);
    assert.equal(can("VENTAS", "mot.create", "SERVOMOTORES"), false);
    assert.equal(can("ALMACEN", "equi.view", "SYSTRON"), false);
    assert.equal(can("ALMACEN", "equipment.catalog", "SYSTRON"), false);
    assert.equal(can("ALMACEN", "attention.create", "SYSTRON"), false);
    assert.equal(can("ALMACEN", "mot.view", "SYSTRON"), false);
    assert.equal(can("ALMACEN", "custody.confirm", "SYSTRON"), true);
    assert.equal(can("ALMACEN", "custody.confirm", "SERVOMOTORES"), false);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "mot.create", "SERVOMOTORES"), true);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "custody.confirm", "SERVOMOTORES"), true);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "equi.view", "SERVOMOTORES"), false);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "equipment.catalog", "SERVOMOTORES"), true);
    assert.equal(can("GERENTE_OPERATIVO_SERVOMOTORES", "mot.view", "SERVOMOTORES"), true);
    assert.equal(can("TECNICO", "inventory.operate", "SYSTRON"), false);
    assert.equal(can("TECNICO", "inventory.search", "SYSTRON"), true);
    assert.equal(can("ALMACEN", "inventory.operate", "SYSTRON"), true);
    assert.equal(can("ALMACEN", "inventory.search", "SYSTRON"), true);
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

  it("deja a coordinación operar personal y revisar horas extra sin capturarlas", () => {
    assert.equal(can("COORDINACION_ADMINISTRACION", "personnel.manage"), true);
    assert.equal(can("COORDINACION_ADMINISTRACION", "personnel.authorize"), false);
    assert.equal(can("COORDINACION_ADMINISTRACION", "overtime.capture", "SYSTRON"), false);
    assert.equal(can("COORDINACION_ADMINISTRACION", "overtime.capture", "SERVOMOTORES"), false);
  });

  it("limita requerimientos a SYSTRON y tipos por rol", () => {
    assert.equal(can("VENTAS", "purchase.requirement.create", "SYSTRON"), true);
    assert.equal(can("VENTAS", "purchase.requirement.create", "SERVOMOTORES"), false);
    assert.equal(can("VENTAS", "purchase.requirement.refaccion", "SYSTRON"), false);
    assert.equal(can("ALMACEN", "purchase.requirement.create", "SYSTRON"), true);
    assert.equal(can("ALMACEN", "purchase.requirement.refaccion", "SYSTRON"), true);
    assert.equal(can("SUPERVISOR_TECNICO", "purchase.requirement.refaccion", "SYSTRON"), true);
    assert.equal(can("TECNICO", "purchase.requirement.create", "SYSTRON"), false);
    assert.equal(can("KIOSCO_ASISTENCIA", "purchase.requirement.create", "SYSTRON"), false);
    assert.equal(can("AYUDANTE_GENERAL", "purchase.requirement.create", "SYSTRON"), false);
    assert.equal(can("GERENTE_OPERATIVO_SYSTRON", "purchase.requirement.create", "SYSTRON"), true);
    assert.equal(can("CEO", "purchase.requirement.refaccion", "SYSTRON"), false);
  });

  it("deja al técnico fuera del catálogo de equipos; servicios solo asignados en bandeja", () => {
    assert.equal(can("TECNICO", "attention.catalog", "SYSTRON"), true);
    assert.equal(can("TECNICO", "equipment.catalog", "SYSTRON"), false);
    assert.equal(can("VENTAS", "attention.catalog", "SYSTRON"), true);
    assert.equal(can("SUPERVISOR_TECNICO", "attention.catalog", "SYSTRON"), true);
    assert.equal(can("TECNICO", "panel.view", "SYSTRON"), true);
  });

});
