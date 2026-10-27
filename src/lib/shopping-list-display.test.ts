import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shoppingListKindFromList } from "./shopping-list-display";

describe("tipo de lista de compras", () => {
  it("infiere refacciones por las partidas aunque kind en BD sea general", () => {
    assert.equal(
      shoppingListKindFromList({
        kind: "GENERAL",
        lines: [{ requirement: { kind: "REFACCION" } }, { requirement: { kind: "REFACCION" } }],
      }),
      "REFACCION",
    );
  });

  it("usa kind de la lista si está vacía", () => {
    assert.equal(shoppingListKindFromList({ kind: "REFACCION", lines: [] }), "REFACCION");
  });
});
