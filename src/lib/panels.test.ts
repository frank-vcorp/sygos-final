import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { averageTicket, productionCredit } from "./panels";

describe("producción técnica", () => {
  it("atribuye el cierre validado y deja fuera al gerente de SYSTRON y el valor externo", () => {
    const rows = productionCredit([
      { id: "d1", equipmentId: "e1", kind: "DIAGNOSTICO", attentionType: "DIAGNOSTICO", status: "VALIDADO", external: false, finishedByUserId: "tec", finishedByRole: "TECNICO", validated: true, value: 1000, originalCaseId: null },
      { id: "os1", equipmentId: "e1", kind: "OS", attentionType: "REPARACION", status: "TERMINADA", external: false, finishedByUserId: "tec", finishedByRole: "TECNICO", validated: true, value: 4000, originalCaseId: null },
      { id: "os2", equipmentId: "e2", kind: "OS", attentionType: "REPARACION", status: "TERMINADA", external: true, finishedByUserId: "tec", finishedByRole: "TECNICO", validated: true, value: 9000, originalCaseId: null },
      { id: "d2", equipmentId: "e3", kind: "DIAGNOSTICO", attentionType: "DIAGNOSTICO", status: "VALIDADO", external: false, finishedByUserId: "ger", finishedByRole: "GERENTE_OPERATIVO_SYSTRON", validated: true, value: 500, originalCaseId: null },
      { id: "g1", equipmentId: "e4", kind: "OS", attentionType: "DIAGNOSTICO_GARANTIA", status: "TERMINADA", external: false, finishedByUserId: "sm", finishedByRole: "GERENTE_OPERATIVO_SERVOMOTORES", validated: true, value: 2000, originalCaseId: "os-1" },
    ]);
    const tech = rows.find((row) => row.userId === "tec");
    assert.equal(tech?.value, 5000);
    assert.equal(tech?.jobs, 3);
    assert.equal(rows.some((row) => row.userId === "ger"), false);
    const manager = rows.find((row) => row.userId === "sm");
    assert.equal(manager?.value, 0);
    assert.equal(manager?.warranties, 1);
    assert.equal(averageTicket(5000, 2), 2500);
  });
});
