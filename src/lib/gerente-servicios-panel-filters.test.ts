import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterServicioBandejaForGerentePanel, type GerenteServicioPanelContext } from "./gerente-servicios-panel-filters";
import type { ServicioBandejaRow } from "./servicios-supervisor";

function row(partial: Partial<ServicioBandejaRow> & Pick<ServicioBandejaRow, "id">): ServicioBandejaRow {
  return {
    kind: "servicio",
    equipmentId: "e1",
    equipmentHref: "/equipos/e1",
    equipmentLabel: "EQUI-1",
    diagnosisFolio: null,
    diagnosisHref: null,
    osFolio: null,
    osHref: null,
    clientId: "c1",
    clientName: "Cliente",
    clientIsSystem: false,
    technical: { label: "Activo", tone: "neutral" },
    administrative: { label: "—", tone: "neutral" },
    physical: { label: "En taller", tone: "neutral" },
    sellerName: null,
    technicianName: null,
    quoteFolio: null,
    quoteHref: null,
    quoteMonto: "—",
    slaDueAt: null,
    slaStartedAt: null,
    createdAt: new Date(),
    closedAt: null,
    primaryStatus: "EN_PROCESO",
    ...partial,
  };
}

describe("filterServicioBandejaForGerentePanel", () => {
  const ctx: GerenteServicioPanelContext = {
    now: 1_000_000,
    refaccionAttentionIds: new Set(["att-ref"]),
    purchaseRefs: new Set(["OS-9"]),
  };

  it("filtra validación y asignación", () => {
    const rows = [
      row({ id: "a", primaryStatus: "PENDIENTE_VALIDACION", technicianName: "Técnico" }),
      row({ id: "b", technicianName: null }),
    ];
    assert.equal(filterServicioBandejaForGerentePanel(rows, "validacion", ctx).length, 1);
    assert.equal(filterServicioBandejaForGerentePanel(rows, "asignacion", ctx).length, 1);
  });

  it("filtra vencidos y compras por folio", () => {
    const rows = [
      row({ id: "v", slaDueAt: new Date(0) }),
      row({ id: "c", osFolio: "OS-9" }),
    ];
    assert.equal(filterServicioBandejaForGerentePanel(rows, "vencidos", ctx).length, 1);
    assert.equal(filterServicioBandejaForGerentePanel(rows, "compras", ctx).length, 1);
  });
});
