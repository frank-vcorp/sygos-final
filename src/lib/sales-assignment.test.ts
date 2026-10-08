import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { salesPortfolioClientWhere, salesPortfolioEquipmentWhere, salesPortfolioUserId } from "./sales-assignment";

describe("cartera de ventas", () => {
  it("limita a clientes con ownerUserId del vendedor y excluye sistema", () => {
    assert.deepEqual(salesPortfolioClientWhere("VENTAS", "u1"), { ownerUserId: "u1", isSystem: false });
    assert.deepEqual(salesPortfolioClientWhere("CEO", "u1"), {});
    assert.equal(salesPortfolioUserId("VENTAS", "u1"), "u1");
    assert.equal(salesPortfolioUserId("GERENTE_OPERATIVO_SYSTRON", "u1"), undefined);
    assert.deepEqual(salesPortfolioEquipmentWhere("VENTAS", "u1"), {
      client: { ownerUserId: "u1", isSystem: false },
    });
  });
});
