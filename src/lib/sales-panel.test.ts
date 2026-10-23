import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  quoteCotizadaSinAutorizacion,
  quotePendienteAutorizacion,
  receivableEsVigente,
  servicioCotizadaSinAutorizacion,
  servicioOsValidadaPendienteEntrega,
  servicioOsValidadaSinFacturar,
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
    clientName: "Cliente",
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
  it("separa cotizada sin autorizar de pendiente de autorización en cotizaciones", () => {
    assert.equal(quoteCotizadaSinAutorizacion("PENDIENTE_DECISION"), true);
    assert.equal(quoteCotizadaSinAutorizacion("NO_AUTORIZADA"), false);
    assert.equal(quotePendienteAutorizacion("PENDIENTE_COTIZAR"), true);
    assert.equal(quotePendienteAutorizacion("PENDIENTE_DECISION"), false);
  });

  it("alinea seguimiento con edo. administrativo de servicios", () => {
    assert.equal(
      servicioCotizadaSinAutorizacion(row({ administrative: { label: "Cotizado", tone: "info" } })),
      true,
    );
    assert.equal(
      servicioCotizadaSinAutorizacion(row({ administrative: { label: "Cotizado", tone: "info", tags: ["Autorizado"] } })),
      false,
    );
  });

  it("detecta OS validada sin facturar y pendiente de entrega", () => {
    assert.equal(servicioOsValidadaSinFacturar(row({})), true);
    assert.equal(servicioOsValidadaSinFacturar(row({ osFolio: null })), false);
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
