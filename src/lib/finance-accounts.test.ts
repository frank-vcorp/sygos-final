import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPaymentMatchesAccountKind,
  buildFinanceAccountStoredName,
  expectedFinanceAccountKindForPayment,
  financeAccountDisplayName,
  financeAccountKindLabel,
  normalizeFinanceAccountKind,
  normalizeOperationalPaymentType,
  parseLastFour,
  paymentTypeRequiresTreasuryAccount,
} from "./finance-accounts";

describe("finance-accounts", () => {
  it("normaliza tipos legacy de cuenta", () => {
    assert.equal(normalizeFinanceAccountKind("BANCO"), "BANCARIA");
    assert.equal(normalizeFinanceAccountKind("TARJETA"), "CREDITO");
    assert.equal(normalizeFinanceAccountKind("BANCARIA"), "BANCARIA");
  });

  it("arma etiqueta de visualización con banco y últimos 4", () => {
    assert.equal(
      financeAccountDisplayName({ kind: "BANCARIA", name: "x", bankName: "BBVA", lastFour: "1234" }),
      "BBVA ····1234",
    );
    assert.equal(buildFinanceAccountStoredName({ kind: "EFECTIVO", cashName: "" }), "Efectivo");
    assert.equal(buildFinanceAccountStoredName({ kind: "EFECTIVO", cashName: "Caja norte" }), "Caja norte");
  });

  it("normaliza formas de pago legacy", () => {
    assert.equal(normalizeOperationalPaymentType("CONTADO"), "EFECTIVO");
    assert.equal(normalizeOperationalPaymentType("TARJETA"), "TC");
    assert.equal(normalizeOperationalPaymentType("TRANSFERENCIA"), "TRANSFERENCIA");
  });

  it("relaciona forma de pago con tipo de cuenta", () => {
    assert.equal(expectedFinanceAccountKindForPayment("TD"), "BANCARIA");
    assert.equal(expectedFinanceAccountKindForPayment("TC"), "CREDITO");
    assert.equal(expectedFinanceAccountKindForPayment("EFECTIVO"), "EFECTIVO");
    assert.equal(paymentTypeRequiresTreasuryAccount("CREDITO"), false);
    assert.throws(() => assertPaymentMatchesAccountKind("TC", "BANCARIA"), /Crédito \(tarjeta\)/);
    assert.doesNotThrow(() => assertPaymentMatchesAccountKind("TC", "TARJETA"));
  });

  it("valida últimos 4 dígitos", () => {
    assert.equal(parseLastFour("12 34"), "1234");
    assert.throws(() => parseLastFour("123"), /4 dígitos/);
    assert.throws(() => parseLastFour("", { required: true }), /últimos 4/);
  });

  it("etiqueta tipos de cuenta", () => {
    assert.equal(financeAccountKindLabel("BANCO"), "Bancaria");
    assert.equal(financeAccountKindLabel("TARJETA"), "Crédito (tarjeta)");
  });
});
