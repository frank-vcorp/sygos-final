import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSellerDiscountAllowed } from "./quotes";

describe("descuento de vendedor", () => {
  it("exige límite configurado para cualquier descuento mayor a cero", () => {
    assert.throws(() => assertSellerDiscountAllowed(5, null), /límite de descuento configurado/);
    assert.throws(() => assertSellerDiscountAllowed(5, undefined), /límite de descuento configurado/);
  });

  it("respeta el tope individual", () => {
    assert.throws(() => assertSellerDiscountAllowed(12, 10), /10%/);
    assertSellerDiscountAllowed(10, 10);
    assertSellerDiscountAllowed(0, null);
  });
});
