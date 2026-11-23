import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cobranzaVigenteRowIds,
  supervisorServicioRowStableId,
  vencidoServicioRowIds,
} from "@/lib/panel-servicio-row-highlight-ids";
import type { SupervisorServicioRow } from "@/lib/servicios-supervisor-rows";

function servicioRow(overrides: Partial<SupervisorServicioRow> & { id: string; equipmentId: string }): SupervisorServicioRow {
  return {
    kind: "servicio",
    id: overrides.id,
    equipmentId: overrides.equipmentId,
    equipmentKind: "MOT",
    equipmentHref: "/eq/1",
    equipmentLabel: "EQ",
    diagnosisFolio: null,
    diagnosisHref: null,
    osFolio: null,
    osHref: null,
    clientId: "c1",
    clientName: "Cliente",
    clientIsSystem: false,
    technical: { primary: "", secondary: null, tone: "neutral" },
    administrative: { primary: "", secondary: null, tone: "neutral" },
    physical: { primary: "", secondary: null, tone: "neutral" },
    sellerName: null,
    technicianName: null,
    quoteFolio: null,
    quoteHref: null,
    quoteStatus: null,
    quoteSellerUserId: null,
    quoteMonto: "$0",
    slaDueAt: overrides.slaDueAt ?? null,
    slaStartedAt: null,
    attentionCreatedAt: new Date("2024-01-01"),
    priorityName: "Normal",
    attentionType: "REPARACION_TALLER",
    createdAt: new Date("2024-01-01"),
    closedAt: null,
    primaryStatus: overrides.primaryStatus ?? "EN_PROCESO",
    ...overrides,
  } as SupervisorServicioRow;
}

describe("panel-servicio-row-highlight-ids", () => {
  it("stable id para cancelados usa prefijo att-", () => {
    const row: SupervisorServicioRow = {
      kind: "cancelado",
      id: "x1",
      equipmentId: "e1",
      equipmentHref: "/e",
      equipmentLabel: "E",
      clientId: "c",
      clientName: "C",
      clientIsSystem: false,
      closedAt: new Date(),
      createdAt: new Date(),
      priorityName: "Normal",
    };
    assert.equal(supervisorServicioRowStableId(row), "att-x1");
  });

  it("cobranzaVigenteRowIds filtra por equipmentId", () => {
    const rows = [
      servicioRow({ id: "a", equipmentId: "eq-vig" }),
      servicioRow({ id: "b", equipmentId: "eq-otro" }),
    ];
    assert.deepEqual(cobranzaVigenteRowIds(rows, new Set(["eq-vig"])), ["a"]);
  });

  it("vencidoServicioRowIds incluye filas con SLA vencido", () => {
    const past = new Date("2020-01-01");
    const rows = [servicioRow({ id: "v", equipmentId: "e", slaDueAt: past })];
    assert.deepEqual(vencidoServicioRowIds(rows, new Date("2025-01-01")), ["v"]);
  });
});