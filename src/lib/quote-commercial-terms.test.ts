import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_QUOTE_PAYMENT_CONDITION,
  DEFAULT_QUOTE_WARRANTY_MONTHS,
  parsePaymentCondition,
  parseWarrantyMonths,
  quotePaymentConditionDisplay,
  warrantyMonthsLabel,
} from "./quote-commercial-terms";

describe("quote commercial terms", () => {
  it("parseWarrantyMonths acepta 3, 6, 9 y 12", () => {
    assert.equal(parseWarrantyMonths("3"), 3);
    assert.equal(parseWarrantyMonths("12"), 12);
    assert.throws(() => parseWarrantyMonths("5"), /3, 6, 9 o 12/);
    assert.throws(() => parseWarrantyMonths(""), /garantía/);
  });

  it("parsePaymentCondition acepta códigos estables", () => {
    assert.equal(parsePaymentCondition("ANTICIPADO"), "ANTICIPADO");
    assert.equal(parsePaymentCondition("CREDITO"), "CREDITO");
    assert.throws(() => parsePaymentCondition("EFECTIVO"), /no son válidas/);
  });

  it("defaults sensatos para el formulario", () => {
    assert.equal(DEFAULT_QUOTE_WARRANTY_MONTHS, 12);
    assert.equal(DEFAULT_QUOTE_PAYMENT_CONDITION, "CONTADO");
  });

  it("etiquetas para detalle y documento", () => {
    assert.equal(warrantyMonthsLabel(6), "6 meses de garantía");
    assert.equal(quotePaymentConditionDisplay("CONTADO", null), "Contado");
    assert.equal(quotePaymentConditionDisplay("CREDITO", 30), "Crédito (30 días)");
    assert.equal(quotePaymentConditionDisplay(null, 15), "15 días de crédito");
    assert.equal(quotePaymentConditionDisplay(null, null), "Contado");
  });
});