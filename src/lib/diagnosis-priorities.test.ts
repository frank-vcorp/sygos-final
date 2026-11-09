import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { diagnosisPriorityEquipmentKind } from "./priorities";
import { filterDiagnosisPrioritiesForEquipment } from "./diagnosis-priorities-shared";

describe("diagnosis priority catalog by equipment kind", () => {
  it("SERVOMOTORES always uses MOT catalog", () => {
    assert.equal(diagnosisPriorityEquipmentKind("SERVOMOTORES", "EQUI"), "MOT");
  });

  it("SYSTRON splits EQUI vs MOT", () => {
    const options = [
      { id: "1", name: "Normal", equipmentKind: "EQUI" as const, label: "Normal" },
      { id: "2", name: "Normal", equipmentKind: "MOT" as const, label: "Normal · MOT" },
    ];
    assert.equal(filterDiagnosisPrioritiesForEquipment(options, "SYSTRON", "MOT").length, 1);
    assert.equal(filterDiagnosisPrioritiesForEquipment(options, "SYSTRON", "EQUI")[0]?.id, "1");
  });
});
