import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { administrativeStatus } from "./servicios-bandeja";
import {
  receivableEsVigente,
  servicioCotizadaSinAutorizacion,
  servicioOsValidadaAutorizada,
  servicioOsValidadaPendienteEntrega,
  servicioPendienteAutorizacion,
} from "./sales-panel";
import type { ServicioBandejaRow } from "./servicios-supervisor";

function row(partial: Partial<ServicioBandejaRow>): ServicioBandejaRow {
  return {
    kind: "servicio",
    id: "a1",
    equipmentId: "e1",
    equipmentHref: "/equipos/e1",
    equipmentLabel: "EQ-1",
    diagnosisFolio: null,
    diagnosisHref: null,
    osFolio: "OS-1",
    osHref: "/operacion/os1",
    clientId: "c1",
    clientName: "Cliente",
    clientIsSystem: false,
    technical: { label: "Validado", tone: "ok" },
    administrative: { label: "Cotizado", tone: "info", tags: ["Autorizado"] },
    physical: { label: "En resguardo", tone: "ok" },
    sellerName: null,
    technicianName: null,
    slaDueAt: null,
    slaStartedAt: null,
    createdAt: new Date(),
    closedAt: null,
    primaryStatus: "VALIDADO",
    ...partial,
  };
}

describe("sales panel filters", () => {
  it("usa los mismos subestados que administrativeStatus", () => {
    const pendiente = administrativeStatus({
      attentionType: "DIAGNOSTICO",
      quoteStatus: "PENDIENTE_DECISION",
      quotePending: false,
      warrantyDecision: null,
    });
    const rechazada = administrativeStatus({
      attentionType: "DIAGNOSTICO",
      quoteStatus: "NO_AUTORIZADA",
      quotePending: false,
      warrantyDecision: null,
    });
    assert.equal(servicioCotizadaSinAutorizacion(row({ administrative: pendiente })), true);
    assert.equal(servicioPendienteAutorizacion(row({ administrative: rechazada })), true);
    assert.equal(servicioPendienteAutorizacion(row({ administrative: pendiente })), false);
  });

  it("detecta OS validada autorizada y pendiente de entrega", () => {
    assert.equal(servicioOsValidadaAutorizada(row({})), true);
    assert.equal(
      servicioOsValidadaAutorizada(row({ administrative: { label: "Cotizado", tone: "info" } })),
      false,
    );
    assert.equal(servicioOsValidadaPendienteEntrega(row({})), true);
    assert.equal(servicioOsValidadaPendienteEntrega(row({ physical: { label: "Entregado", tone: "neutral" } })), false);
  });

  it("marca CxC vigente", () => {
    const future = new Date(Date.now() + 86400000);
    const past = new Date(Date.now() - 86400000);
    assert.equal(receivableEsVigente(future, 100), true);
    assert.equal(receivableEsVigente(past, 100), false);
    assert.equal(receivableEsVigente(past, 0), false);
  });
});
