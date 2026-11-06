import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapEquipmentToAlmacenRow } from "./almacen-bandeja";

describe("almacen bandeja", () => {
  it("expone DX y oculta OS reservada hasta autorizar reparación", () => {
    const row = mapEquipmentToAlmacenRow(
      {
        id: "e1",
        kind: "EQUI",
        folio: "EQUI-1",
        typeName: "AMP",
        brandName: "FANUC",
        model: "M1",
        custody: "EN_RESGUARDO",
        client: { id: "c1", name: "Cliente A", isSystem: false },
        attentions: [
          {
            id: "att1",
            status: "EN_PROCESO",
            slaStartedAt: new Date(),
            attentionType: "DIAGNOSTICO",
            sellerUserId: "s1",
            technicalCases: [
              { id: "dx1", folio: "DX-1", kind: "DIAGNOSTICO", spawnedFromId: null, quotePending: false },
              { id: "os1", folio: "OS-1", kind: "OS", spawnedFromId: "dx1", quotePending: true },
            ],
          },
        ],
      },
      {},
    );
    assert.equal(row.diagnosisFolio, "DX-1");
    assert.equal(row.osFolio, null);
    assert.equal(row.osHref, null);
    assert.equal(row.physical.label, "En resguardo");
    assert.match(row.equipmentLabel, /EQUI-1/);
  });

  it("muestra OS cuando la reparación ya está autorizada", () => {
    const row = mapEquipmentToAlmacenRow(
      {
        id: "e1",
        kind: "EQUI",
        folio: "EQUI-2",
        typeName: null,
        brandName: null,
        model: "M2",
        custody: "EN_RESGUARDO",
        client: { id: "c1", name: "Cliente A", isSystem: false },
        attentions: [
          {
            id: "att1",
            status: "EN_PROCESO",
            slaStartedAt: new Date(),
            attentionType: "DIAGNOSTICO",
            sellerUserId: null,
            technicalCases: [
              { id: "dx1", folio: "DX-2", kind: "DIAGNOSTICO", spawnedFromId: null, quotePending: false },
              { id: "os1", folio: "OS-2", kind: "OS", spawnedFromId: "dx1", quotePending: false },
            ],
          },
        ],
      },
      {},
    );
    assert.equal(row.osFolio, "OS-2");
  });
});
