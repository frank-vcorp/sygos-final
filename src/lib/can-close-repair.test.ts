import assert from "node:assert/strict";
import test from "node:test";
import { canCloseRepair } from "./technical";

test("canCloseRepair: taller ejecutor y ventas con cartera", () => {
  const sy = { activeCompanyCode: "SYSTRON" as const };
  assert.equal(canCloseRepair({ role: "TECNICO", userId: "t1", ...sy }, "t1", "v1"), true);
  assert.equal(canCloseRepair({ role: "TECNICO", userId: "t1", ...sy }, "t2", "v1"), false);
  assert.equal(canCloseRepair({ role: "SUPERVISOR_TECNICO", userId: "s1", ...sy }, null, "v1"), true);
  assert.equal(canCloseRepair({ role: "VENTAS", userId: "v1", ...sy }, null, "v1"), true);
  assert.equal(canCloseRepair({ role: "VENTAS", userId: "v1", ...sy }, null, "v2"), false);
  assert.equal(canCloseRepair({ role: "ALMACEN", userId: "a1", ...sy }, null, "v1"), false);
});
