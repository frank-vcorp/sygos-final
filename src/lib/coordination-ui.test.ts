import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { coordUsesSidebarNav } from "./coordination-ui";

describe("coordUsesSidebarNav", () => {
  it("solo aplica a Coordinación de Administración", () => {
    assert.equal(coordUsesSidebarNav("COORDINACION_ADMINISTRACION"), true);
    assert.equal(coordUsesSidebarNav("CEO"), false);
    assert.equal(coordUsesSidebarNav("ADMINISTRADOR"), false);
  });
});
