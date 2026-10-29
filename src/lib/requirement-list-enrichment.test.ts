import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { equipmentIdentificationLabel, requirementPartNumberRequired, requirementPartidaLabel } from "./requirement-display";

describe("requerimientos en lista", () => {
  it("solo exige número de parte en refacciones", () => {
    assert.equal(requirementPartNumberRequired("REFACCION"), true);
    assert.equal(requirementPartNumberRequired("GENERAL"), false);
  });

  it("prioriza descripción como partida visible", () => {
    assert.equal(requirementPartidaLabel({ partNumber: "ABC", description: "Filtro de aceite" }), "Filtro de aceite");
    assert.equal(requirementPartidaLabel({ partNumber: "ABC", description: "" }), "ABC");
    assert.equal(requirementPartidaLabel({ partNumber: "", description: "" }), "—");
  });

  it("formatea identificación de equipo como en equipos", () => {
    assert.equal(
      equipmentIdentificationLabel({
        folio: "EQUI-0001",
        typeName: "SERVO",
        brandName: "Siemens",
        model: "1LA7",
        serial: "SN-9",
      }),
      "EQUI-0001 | SERVO | Siemens | 1LA7",
    );
    assert.equal(
      equipmentIdentificationLabel({ brandName: "Siemens", model: "1LA7", serial: "SN-9" }),
      "Siemens · 1LA7 · SN-9",
    );
    assert.equal(equipmentIdentificationLabel({ brandName: null, model: "Genérico", serial: null }), "Genérico");
  });
});
