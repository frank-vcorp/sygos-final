import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeGerenteServomotoresPendientesAutorizacion } from "./gerente-servomotores-panel";
import type { ServicioBandejaRow } from "./servicios-supervisor";

function row(partial: Partial<ServicioBandejaRow> & { id: string }): ServicioBandejaRow {
  return {
    kind: "servicio",
    equipmentId: "eq",
    equipmentKind: "MOT",
    equipmentHref: "/motores/eq",
    equipmentLabel: "MOT-1",
    diagnosisFolio: null,
    diagnosisHref: null,
    osFolio: null,
    osHref: null,
    clientId: "c1",
    clientName: "Cliente",
    clientIsSystem: false,
    technical: { label: "—", tone: "neutral" },
    administrative: { label: "Cotizado", tone: "neutral", tags: [] },
    physical: { label: "En resguardo", tone: "ok" },
    sellerName: null,
    technicianName: null,
    quoteFolio: "COT-1",
    quoteHref: "/cotizaciones/q1",
    quoteStatus: "PENDIENTE_DECISION",
    quoteSellerUserId: null,
    quoteMonto: "—",
    slaDueAt: null,
    slaStartedAt: null,
    attentionCreatedAt: new Date(),
    priorityName: "Normal",
    attentionType: "DIAGNOSTICO",
    createdAt: new Date(),
    closedAt: null,
    primaryStatus: "PENDIENTE_DECISION",
    ...partial,
  };
}

describe("mergeGerenteServomotoresPendientesAutorizacion", () => {
  it("agrega cotizaciones huérfanas sin filtrar por vendedor", () => {
    const merged = mergeGerenteServomotoresPendientesAutorizacion(
      [],
      [row({ id: "quote-q2", quoteHref: "/cotizaciones/q2" })],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.quoteHref, "/cotizaciones/q2");
  });
});
