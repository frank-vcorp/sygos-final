import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientMatchesQuery } from "./client-search";

describe("búsqueda de clientes", () => {
  it("encuentra por razón social sin importar mayúsculas", () => {
    assert.equal(clientMatchesQuery("OERLIKON BALZERS", null, "oerlikon"), true);
  });
  it("encuentra por RFC parcial", () => {
    assert.equal(clientMatchesQuery("Acme", "AME120517T72", "ame120"), true);
  });
});
