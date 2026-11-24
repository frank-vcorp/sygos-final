import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_QUOTE_CREDIT_DAYS,
  DEFAULT_QUOTE_PAYMENT_CONDITION,
  DEFAULT_QUOTE_WARRANTY_MONTHS,
  parsePaymentCondition,
  parseQuoteCreditDays,
  parseWarrantyMonths,
  quoteCreditDaysFieldValue,
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

  it("parseQuoteCreditDays solo aplica a CREDITO", () => {
    assert.equal(parseQuoteCreditDays("CONTADO", "30"), null);
    assert.equal(parseQuoteCreditDays("ANTICIPADO", ""), null);
    assert.equal(parseQuoteCreditDays("CREDITO", "30"), 30);
    assert.equal(parseQuoteCreditDays("CREDITO", ""), DEFAULT_QUOTE_CREDIT_DAYS);
    assert.throws(() => parseQuoteCreditDays("CREDITO", "0"), /entero mayor/);
  });

  it("DEFAULT_QUOTE_CREDIT_DAYS y campo inicial con CREDITO", () => {
    assert.equal(DEFAULT_QUOTE_CREDIT_DAYS, 30);
    assert.equal(quoteCreditDaysFieldValue("CONTADO", 45), "");
    assert.equal(quoteCreditDaysFieldValue("CREDITO", 45), "45");
    assert.equal(quoteCreditDaysFieldValue("CREDITO", null), "30");
  });

  it("defaults sensatos para el formulario", () => {
    assert.equal(DEFAULT_QUOTE_WARRANTY_MONTHS, 12);
    assert.equal(DEFAULT_QUOTE_PAYMENT_CONDITION, "CREDITO");
    assert.equal(quoteCreditDaysFieldValue(DEFAULT_QUOTE_PAYMENT_CONDITION, null), "30");
  });

  it("etiquetas para detalle y documento", () => {
    assert.equal(warrantyMonthsLabel(6), "6 meses de garantía");
    assert.equal(quotePaymentConditionDisplay("CONTADO", null), "Contado");
    assert.equal(quotePaymentConditionDisplay("CREDITO", 30), "Crédito (30 días)");
    assert.equal(quotePaymentConditionDisplay(null, 15), "15 días de crédito");
    assert.equal(quotePaymentConditionDisplay(null, null), "Contado");
  });
});