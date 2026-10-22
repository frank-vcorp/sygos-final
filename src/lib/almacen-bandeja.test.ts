import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapEquipmentToAlmacenRow } from "./almacen-bandeja";

describe("almacen bandeja", () => {
  it("expone DX, OS, equipo y edo físico", () => {
    const row = mapEquipmentToAlmacenRow(
      {
        id: "e1",
        kind: "EQUI",
        folio: "EQUI-1",
        typeName: "AMP",
        brandName: "FANUC",
        model: "M1",
        custody: "EN_RESGUARDO",
        client: { name: "Cliente A" },
        attentions: [
          {
            id: "att1",
            status: "EN_PROCESO",
            slaStartedAt: new Date(),
            attentionType: "DIAGNOSTICO",
            sellerUserId: "s1",
            technicalCases: [
              { id: "dx1", folio: "DX-1", kind: "DIAGNOSTICO", spawnedFromId: null },
              { id: "os1", folio: "OS-1", kind: "OS", spawnedFromId: "dx1" },
            ],
          },
        ],
      },
      {},
    );
    assert.equal(row.diagnosisFolio, "DX-1");
    assert.equal(row.osFolio, "OS-1");
    assert.equal(row.physical.label, "En resguardo");
    assert.match(row.equipmentLabel, /EQUI-1/);
  });
});
