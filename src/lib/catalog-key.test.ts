import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogKey } from "./catalog-key";

describe("clave de catálogo", () => {
  it("ignora mayúsculas, espacios y guiones", () => {
    assert.equal(catalogKey("A06B-6127-H110"), catalogKey("a06b6127h110"));
    assert.equal(catalogKey("3HNE 00313-1"), catalogKey("3HNE00313-1"));
    assert.equal(catalogKey("Fanuc"), catalogKey("FANUC"));
  });

  it("conserva la diagonal y el punto", () => {
    assert.notEqual(catalogKey("20 HP"), catalogKey("20/15 HP"));
    assert.notEqual(catalogKey("A860-0360-T021"), catalogKey("A860-0360-T01"));
  });
});