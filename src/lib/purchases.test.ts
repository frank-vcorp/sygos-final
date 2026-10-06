import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withinDirectLimits } from "./purchases";

describe("compra directa", () => {
  it("exige límite individual y presupuesto del mes al mismo tiempo", () => {
    assert.equal(withinDirectLimits(2000, 3000, 2000, 5000), true);
    assert.equal(withinDirectLimits(2001, 0, 2000, 5000), false);
    assert.equal(withinDirectLimits(1500, 4000, 2000, 5000), false);
    assert.equal(withinDirectLimits(0, 0, 2000, 5000), false);
  });
});
