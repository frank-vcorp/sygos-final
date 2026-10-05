import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allowedMovements, nextCustody, reasonsFor } from "./custody";

describe("custodia física", () => {
  it("recibe un EQUI en almacén y deja salir a prueba sin cerrarlo", () => {
    assert.equal(nextCustody("EQUI", "SIN_CUSTODIA", "ENTRADA"), "EN_RESGUARDO");
    assert.equal(nextCustody("EQUI", "EN_RESGUARDO", "SALIDA_PRUEBA"), "FUERA_A_PRUEBA");
    assert.equal(nextCustody("EQUI", "FUERA_A_PRUEBA", "RETORNO"), "EN_RESGUARDO");
    assert.equal(nextCustody("EQUI", "FUERA_A_PRUEBA", "SALIDA"), "FUERA");
  });

  it("impide que un MOT originado para Servomotores entre al almacén SYSTRON", () => {
    assert.throws(() => nextCustody("MOT", "PENDIENTE_INGRESO", "ENTRADA"));
    assert.equal(nextCustody("MOT", "PENDIENTE_INGRESO", "INGRESO"), "EN_RESGUARDO");
    assert.deepEqual(allowedMovements("MOT", "EN_RESGUARDO"), ["SALIDA_PRUEBA", "SALIDA_PROVEEDOR", "EGRESO"]);
  });

  it("toma el motivo de entrada del catálogo del almacén", () => {
    assert.deepEqual(reasonsFor("ENTRADA"), [
      "Diagnóstico",
      "Reparación",
      "Diagnóstico de Garantía",
      "Venta de equipo",
      "Retorno de proveedor",
    ]);
    assert.deepEqual(reasonsFor("SALIDA_PRUEBA"), ["Salida a prueba"]);
  });

  it("no simula retorno si el equipo permanece fuera después de la prueba", () => {
    assert.equal(nextCustody("MOT", "FUERA_A_PRUEBA", "EGRESO"), "FUERA");
    assert.throws(() => nextCustody("MOT", "FUERA", "RETORNO"));
  });
});
