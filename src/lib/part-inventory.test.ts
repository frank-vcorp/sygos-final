import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  partAvailableQty,
  partRequestIssueable,
  partRequestNeedsSupply,
  partRequestShortfall,
} from "./part-inventory";

describe("inventario y solicitudes de refacción", () => {
  it("calcula existencia disponible descontando apartados", () => {
    assert.equal(partAvailableQty({ qty: 10, qtyReserved: 3 }), 7);
  });

  it("permite surtir desde apartado sin recepción previa", () => {
    const request = { qtyRequested: 5, qtyReserved: 5, qtyReceived: 0, qtyIssued: 0 };
    assert.equal(partRequestIssueable(request), 5);
    assert.equal(partRequestShortfall(request), 0);
    assert.equal(partRequestNeedsSupply(request), false);
  });

  it("marca faltante cuando no hay stock ni recepción", () => {
    const request = { qtyRequested: 8, qtyReserved: 2, qtyReceived: 0, qtyIssued: 0 };
    assert.equal(partRequestShortfall(request), 6);
    assert.equal(partRequestNeedsSupply(request), true);
  });

  it("combina apartado y recibido para surtido", () => {
    const request = { qtyRequested: 10, qtyReserved: 3, qtyReceived: 4, qtyIssued: 2 };
    assert.equal(partRequestIssueable(request), 5);
    assert.equal(partRequestShortfall(request), 3);
  });
});
