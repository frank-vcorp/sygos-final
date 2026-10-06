import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isParticipant } from "./db";

describe("modo de pruebas", () => {
  it("incluye al usuario o al rol elegido y a nadie más", () => {
    const meta = { active: true, userIds: ["u1"], roles: ["VENTAS"] };
    assert.equal(isParticipant(meta, "u1", "TECNICO"), true);
    assert.equal(isParticipant(meta, "u2", "VENTAS"), true);
    assert.equal(isParticipant(meta, "u2", "TECNICO"), false);
    assert.equal(isParticipant({ ...meta, active: false }, "u1", "VENTAS"), false);
  });
});
