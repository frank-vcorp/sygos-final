import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  administrativeStatus,
  physicalStatusFromCustody,
  serviciosBandejaColumns,
  technicalStatusFromCase,
} from "./servicios-bandeja";

describe("technicalStatusFromCase", () => {
  it("agrupa refacciones bajo en proceso", () => {
    const row = technicalStatusFromCase("EN_ESPERA_REFACCIONES");
    assert.equal(row.label, "En proceso");
    assert.deepEqual(row.tags, ["En espera de refacciones"]);
  });

  it("mapea devuelto a en proceso", () => {
    assert.equal(technicalStatusFromCase("DEVUELTO").label, "En proceso");
  });
});

describe("administrativeStatus", () => {
  it("reparación directa: sin cotizar con autorizado", () => {
    const row = administrativeStatus({
      attentionType: "REPARACION",
      quoteStatus: null,
      quotePending: false,
      warrantyDecision: null,
    });
    assert.equal(row.label, "Sin cotizar");
    assert.deepEqual(row.tags, ["Autorizado"]);
  });

  it("cotizado pendiente de decisión sin subestado", () => {
    const row = administrativeStatus({
      attentionType: "DIAGNOSTICO",
      quoteStatus: "PENDIENTE_DECISION",
      quotePending: false,
      warrantyDecision: null,
    });
    assert.equal(row.label, "Cotizado");
    assert.equal(row.tags, undefined);
  });

  it("cotizado no autorizado lleva subestado", () => {
    const row = administrativeStatus({
      attentionType: "DIAGNOSTICO",
      quoteStatus: "NO_AUTORIZADA",
      quotePending: false,
      warrantyDecision: null,
    });
    assert.deepEqual(row.tags, ["No autorizado"]);
  });

  it("garantía no procedente sin cotización", () => {
    const row = administrativeStatus({
      attentionType: "DIAGNOSTICO_GARANTIA",
      quoteStatus: null,
      quotePending: false,
      warrantyDecision: "NO_PROCEDENTE",
    });
    assert.equal(row.label, "Sin cotizar");
  });
});

describe("physicalStatusFromCustody", () => {
  it("proveedor cuenta como en pruebas", () => {
    assert.equal(physicalStatusFromCustody("EN_PROVEEDOR").label, "En pruebas");
  });
});

describe("serviciosBandejaColumns", () => {
  it("oculta administrativo al técnico y gerente", () => {
    assert.equal(serviciosBandejaColumns("TECNICO").edoAdministrativo, false);
    assert.equal(serviciosBandejaColumns("GERENTE_OPERATIVO_SYSTRON").edoAdministrativo, false);
    assert.equal(serviciosBandejaColumns("SUPERVISOR_TECNICO").edoAdministrativo, false);
    assert.equal(serviciosBandejaColumns("CEO").edoAdministrativo, true);
  });

  it("supervisor técnico ve columnas de taller sin cotización comercial", () => {
    const cols = serviciosBandejaColumns("SUPERVISOR_TECNICO");
    assert.equal(cols.edoTecnico, true);
    assert.equal(cols.edoFisico, true);
    assert.equal(cols.tecnico, true);
    assert.equal(cols.sla, true);
    assert.equal(cols.cotizacion, false);
  });

  it("oculta vendedor a ventas", () => {
    assert.equal(serviciosBandejaColumns("VENTAS").vendedor, false);
  });

  it("bandeja de ventas prioriza cotización y oculta taller", () => {
    const cols = serviciosBandejaColumns("VENTAS");
    assert.equal(cols.edoTecnico, false);
    assert.equal(cols.tecnico, false);
    assert.equal(cols.sla, false);
    assert.equal(cols.cotizacion, true);
    assert.equal(cols.cotizacionMonto, true);
  });

  it("panel cotizaciones ventas puede ocultar monto", () => {
    const cols = serviciosBandejaColumns("VENTAS", { quoteMonto: false });
    assert.equal(cols.cotizacion, true);
    assert.equal(cols.cotizacionMonto, false);
  });
});
