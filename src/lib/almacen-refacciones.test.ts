import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeSamuelFollowUpState,
  formatAlmacenPartialSupplyBadge,
  formatPartShelfLocation,
} from "./almacen-refacciones";

describe("panel de refacciones de almacén (El Gallo)", () => {
  it("formatea ubicación física en estante (rack, nivel y línea)", () => {
    assert.equal(
      formatPartShelfLocation({ rack: "2", nivel: "6", catalogLine: 14, catalogNumero: "A1" }),
      "Rack 2 Nivel 6 · Línea 14 · Núm. A1",
    );
    assert.equal(formatPartShelfLocation(null), "Sin ubicación en catálogo");
  });

  it("muestra aviso de surtido parcial cuando hay stock apartado pero faltan piezas por comprar", () => {
    assert.equal(
      formatAlmacenPartialSupplyBadge({
        qtyRequested: 5,
        qtyReserved: 2,
        qtyReceived: 0,
        qtyIssued: 0,
      }),
      "Parcial: 2 en almacén de 5 solicitadas (3 pendientes de compra)",
    );
    assert.equal(
      formatAlmacenPartialSupplyBadge({
        qtyRequested: 5,
        qtyReserved: 5,
        qtyReceived: 0,
        qtyIssued: 0,
      }),
      null,
    );
  });

  it("clasifica el estado de seguimiento con Samuel (pendiente, en lista y comprada)", () => {
    const future = new Date(Date.now() + 86_400_000);
    const past = new Date(Date.now() - 86_400_000);

    const pendingOk = describeSamuelFollowUpState({
      requirement: { status: "PENDIENTE" },
      slaDueAt: future,
    });
    assert.equal(pendingOk.stage, "PENDIENTE_SAMUEL");
    assert.equal(pendingOk.tone, "warn");
    assert.equal(pendingOk.label, "Pendiente con Samuel");

    const pendingOverdue = describeSamuelFollowUpState({
      requirement: { status: "PENDIENTE" },
      slaDueAt: past,
    });
    assert.equal(pendingOverdue.stage, "PENDIENTE_SAMUEL");
    assert.equal(pendingOverdue.tone, "danger");
    assert.equal(pendingOverdue.label, "Pendiente con Samuel · SLA vencido");

    const inList = describeSamuelFollowUpState({
      requirement: {
        status: "EN_LISTA",
        shoppingList: { folio: "LC-0004", supplier: { name: "Mouser" } },
      },
      slaDueAt: future,
    });
    assert.equal(inList.stage, "EN_LISTA");
    assert.equal(inList.label, "En lista de compras (LC-0004 · Mouser)");

    const bought = describeSamuelFollowUpState({
      requirement: {
        status: "ATENDIDO",
        purchaseId: "pur-1",
        purchase: { folio: "COM-0012" },
      },
      slaDueAt: future,
    });
    assert.equal(bought.stage, "COMPRADA");
    assert.equal(bought.tone, "ok");
    assert.equal(bought.label, "Comprada (COM-0012) · Por llegar");
  });
});
