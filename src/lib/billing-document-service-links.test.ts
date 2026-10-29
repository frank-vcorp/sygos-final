import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveServiceLinksFromAttentionCases } from "./billing-document-service-links";

describe("billing document service links", () => {
  it("resuelve DX y OS cuando existen en la atención", () => {
    const links = resolveServiceLinksFromAttentionCases([
      { id: "dx1", folio: "DX-1", kind: "DIAGNOSTICO", spawnedFromId: null },
      { id: "os1", folio: "OS-1", kind: "OS", spawnedFromId: "dx1" },
    ]);
    assert.equal(links.diagnosisFolio, "DX-1");
    assert.equal(links.diagnosisHref, null);
    assert.equal(links.osFolio, "OS-1");
    assert.equal(links.osHref, "/operacion/os1");
  });

  it("resuelve solo DX cuando no hay OS", () => {
    const links = resolveServiceLinksFromAttentionCases([
      { id: "dx1", folio: "DX-9", kind: "DIAGNOSTICO", spawnedFromId: null },
    ]);
    assert.equal(links.diagnosisFolio, "DX-9");
    assert.equal(links.diagnosisHref, "/operacion/dx1");
    assert.equal(links.osFolio, null);
    assert.equal(links.osHref, null);
  });

  it("resuelve OS y DX vía spawnedFromId", () => {
    const links = resolveServiceLinksFromAttentionCases([
      { id: "os1", folio: "OS-2", kind: "OS", spawnedFromId: "dx2" },
      { id: "dx2", folio: "DX-2", kind: "DIAGNOSTICO", spawnedFromId: null },
    ]);
    assert.equal(links.diagnosisFolio, "DX-2");
    assert.equal(links.osFolio, "OS-2");
    assert.equal(links.osHref, "/operacion/os1");
  });

  it("devuelve vacío sin casos", () => {
    const links = resolveServiceLinksFromAttentionCases([]);
    assert.equal(links.diagnosisFolio, null);
    assert.equal(links.osFolio, null);
  });
});
