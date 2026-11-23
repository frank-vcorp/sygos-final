import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDeliveryBusinessDays, parseFieldServiceMachineFromForm, parseSellerSaleLines } from "./quote-seller-input";

describe("quote-seller-input", () => {
  it("parseSellerSaleLines lee múltiples líneas", () => {
    const form = new FormData();
    form.append("saleLineConcept", "Equipo A");
    form.append("saleLineQty", "1");
    form.append("saleLinePrice", "10000");
    form.append("saleLineCondition", "NUEVO");
    form.append("saleLineConcept", "Cable");
    form.append("saleLineQty", "2");
    form.append("saleLinePrice", "500");
    form.append("saleLineCondition", "USADO");
    const lines = parseSellerSaleLines(form);
    assert.equal(lines.length, 2);
    assert.equal(lines[1]!.concept, "Cable");
    assert.equal(lines[1]!.lineCondition, "USADO");
    assert.equal(lines[1]!.unitPrice, 500);
  });

  it("parseFieldServiceMachineFromForm exige campos", () => {
    const form = new FormData();
    form.set("fieldServiceBrand", "ABB");
    form.set("fieldServiceModel", "ACS580");
    form.set("fieldServiceSerial", "SN-1");
    form.set("fieldServiceDescription", "Ajuste en sitio");
    const machine = parseFieldServiceMachineFromForm(form);
    assert.equal(machine.brand, "ABB");
    assert.equal(machine.serviceDescription, "Ajuste en sitio");
  });

  it("parseDeliveryBusinessDays valida entero", () => {
    assert.equal(parseDeliveryBusinessDays("7"), 7);
    assert.throws(() => parseDeliveryBusinessDays("0"));
  });
});