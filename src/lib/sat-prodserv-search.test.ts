import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SAT_PRODSERV_SEARCH_MIN_LEN, searchSatProdServ } from "./sat-prodserv-search";

describe("búsqueda c_ClaveProdServ", () => {
  it("exige al menos dos caracteres", () => {
    assert.deepEqual(searchSatProdServ("7"), []);
    assert.ok(searchSatProdServ("72").length > 0);
    assert.equal(SAT_PRODSERV_SEARCH_MIN_LEN, 2);
  });

  it("encuentra por prefijo numérico de clave", () => {
    const hits = searchSatProdServ("72154");
    assert.ok(hits.some((row) => row.key === "72154000"));
  });

  it("encuentra por texto en la descripción", () => {
    const hits = searchSatProdServ("servomotor");
    assert.ok(hits.some((row) => row.key === "93151602" || row.key === "73152102"));
  });
});