import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAlmacenEntradaPreset,
  entradaServiceBadge,
  pickCustodyFlowAttention,
  pickEntradaAttention,
} from "./almacen-entrada";

describe("almacen entrada", () => {
  it("etiqueta DX y OS", () => {
    assert.equal(entradaServiceBadge("DIAGNOSTICO"), "DX");
    assert.equal(entradaServiceBadge("REPARACION"), "OS");
    assert.equal(entradaServiceBadge(null, "DIAGNOSTICO"), "DX");
  });

  it("flujo custodia usa EN_PROCESO con SLA ya iniciado", () => {
    const row = pickCustodyFlowAttention([
      { status: "EN_PROCESO", slaStartedAt: new Date(), attentionType: "REPARACION", reportedFault: "Falla" },
    ]);
    assert.equal(row?.attentionType, "REPARACION");
  });

  it("elige atención aunque no esté ABIERTA si aún no hay SLA", () => {
    const row = pickEntradaAttention([
      { status: "EN_PROCESO", slaStartedAt: null, attentionType: "REPARACION", reportedFault: "Falla" },
    ]);
    assert.equal(row?.attentionType, "REPARACION");
  });

  it("arma preset por defecto sin atención", () => {
    const preset = buildAlmacenEntradaPreset({
      kind: "EQUI",
      custody: "SIN_CUSTODIA",
      clientName: "Cliente",
      attentions: [],
    });
    assert.equal(preset.movement, "ENTRADA");
    assert.equal(preset.reason, "Diagnóstico");
  });
});
