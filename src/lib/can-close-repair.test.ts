import assert from "node:assert/strict";
import test from "node:test";
import { canCloseRepair } from "./technical";

test("canCloseRepair: taller ejecutor y ventas con cartera", () => {
  assert.equal(canCloseRepair({ role: "TECNICO", userId: "t1" }, "t1", "v1"), true);
  assert.equal(canCloseRepair({ role: "TECNICO", userId: "t1" }, "t2", "v1"), false);
  assert.equal(canCloseRepair({ role: "SUPERVISOR_TECNICO", userId: "s1" }, null, "v1"), true);
  assert.equal(canCloseRepair({ role: "VENTAS", userId: "v1" }, null, "v1"), true);
  assert.equal(canCloseRepair({ role: "VENTAS", userId: "v1" }, null, "v2"), false);
  assert.equal(canCloseRepair({ role: "ALMACEN", userId: "a1" }, null, "v1"), false);
});
