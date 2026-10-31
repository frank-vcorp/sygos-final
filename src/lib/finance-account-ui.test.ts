import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { financeAccountDeleteBlockedMessage, financeAccountDeleteConfirm } from "./finance-account-ui";

describe("cuentas financieras del CEO", () => {
  it("explica el bloqueo cuando la cuenta está en uso y no dice nada si se puede eliminar", () => {
    assert.equal(
      financeAccountDeleteBlockedMessage("Caja principal", { movements: 0, purchases: 0, transferTargets: 0, cardPayments: 0 }, 0),
      null,
    );
    assert.equal(
      financeAccountDeleteBlockedMessage("BBVA nómina", { movements: 3, purchases: 0, transferTargets: 0, cardPayments: 0 }, 0),
      "No se puede eliminar la cuenta «BBVA nómina»: está en uso en movimientos financieros.",
    );
    assert.equal(
      financeAccountDeleteBlockedMessage("Caja", { movements: 0, purchases: 2, transferTargets: 0, cardPayments: 0 }, 0),
      "No se puede eliminar la cuenta «Caja»: está en uso en compras.",
    );
    assert.match(
      financeAccountDeleteBlockedMessage("Operaciones", { movements: 1, purchases: 1, transferTargets: 0, cardPayments: 0 }, 0) ?? "",
      /movimientos financieros y compras/,
    );
    assert.equal(
      financeAccountDeleteBlockedMessage("Reserva", { movements: 0, purchases: 0, transferTargets: 1, cardPayments: 0 }, 500),
      "No se puede eliminar la cuenta «Reserva»: está en uso en transferencias.",
    );
    assert.equal(
      financeAccountDeleteBlockedMessage("Amex", { movements: 0, purchases: 0, transferTargets: 0, cardPayments: 2 }, 0),
      "No se puede eliminar la cuenta «Amex»: está en uso en pagos con tarjeta.",
    );
    assert.equal(
      financeAccountDeleteBlockedMessage("Sobrante", { movements: 0, purchases: 0, transferTargets: 0, cardPayments: 0 }, 1200),
      "No se puede eliminar la cuenta «Sobrante»: está en uso en saldo registrado.",
    );
  });

  it("arma el mensaje de confirmación de eliminación", () => {
    assert.equal(
      financeAccountDeleteConfirm("BBVA operaciones"),
      "¿Eliminar la cuenta «BBVA operaciones»? Esta acción no se puede deshacer.",
    );
  });
});
