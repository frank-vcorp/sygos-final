import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enablingBillingCaseIds,
  isDiagnosisAttentionType,
  resolveAlmacenExitAttentionType,
} from "./warehouse-exit";

describe("warehouse exit billing", () => {
  it("incluye OS y DX origen para documentos de cotización", () => {
    assert.deepEqual(enablingBillingCaseIds({ id: "os-1", spawnedFromId: "dx-1" }), ["os-1", "dx-1"]);
    assert.deepEqual(enablingBillingCaseIds({ id: "os-1", spawnedFromId: null }), ["os-1"]);
  });
});

describe("almacén salida DX", () => {
  it("diagnóstico en atención actual gana sobre OS vieja", () => {
    assert.equal(isDiagnosisAttentionType("DIAGNOSTICO"), true);
    assert.equal(
      resolveAlmacenExitAttentionType({
        openAttentionType: "DIAGNOSTICO",
        openAttentionId: "att-new",
        osCase: { attentionId: "att-old", attention: { attentionType: "REPARACION" } },
      }),
      "DIAGNOSTICO",
    );
  });
});
