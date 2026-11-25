import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billingListPpdCobranza,
  documentHasUnpaidBalance,
  facturacionListUsesPaymentMethodColumn,
  paymentMethodShortListLabel,
} from "./billing-list-payment-method";

describe("facturacionListUsesPaymentMethodColumn", () => {
  it("solo Coord y CEO", () => {
    assert.equal(facturacionListUsesPaymentMethodColumn("COORDINACION_ADMINISTRACION"), true);
    assert.equal(facturacionListUsesPaymentMethodColumn("CEO"), true);
    assert.equal(facturacionListUsesPaymentMethodColumn("VENTAS"), false);
    assert.equal(facturacionListUsesPaymentMethodColumn("ADMINISTRADOR"), false);
  });
});

describe("paymentMethodShortListLabel", () => {
  it("devuelve código SAT", () => {
    assert.equal(paymentMethodShortListLabel("PUE"), "PUE");
    assert.equal(paymentMethodShortListLabel("PPD"), "PPD");
    assert.equal(paymentMethodShortListLabel(null), "—");
  });
});

describe("documentHasUnpaidBalance", () => {
  it("el pendiente es el saldo, no el método PPD", () => {
    assert.equal(documentHasUnpaidBalance(1500), true);
    assert.equal(documentHasUnpaidBalance(0), false);
    assert.equal(documentHasUnpaidBalance(null), false);
  });
});

describe("billingListPpdCobranza", () => {
  const base = {
    documentStatus: "EMITIDA" as const,
    kind: "FACTURA",
    paymentMethodSnapshot: "PPD",
    fiscalStatus: "TIMBRADA",
    formatBalance: (n: number) => `$${n}`,
  };

  it("no emitida o sin CxC", () => {
    assert.deepEqual(
      billingListPpdCobranza({ ...base, documentStatus: "SOLICITADA", receivableBalance: null, paymentComplementFiscalStatuses: [], validatedApplicationComplementStatuses: [] }),
      { balanceLine: null, complementLabel: "—", complementWarn: false },
    );
  });

  it("sin REP", () => {
    const row = billingListPpdCobranza({
      ...base,
      receivableBalance: 1000,
      paymentComplementFiscalStatuses: [],
      validatedApplicationComplementStatuses: [],
    });
    assert.equal(row?.complementLabel, "Sin REP");
    assert.equal(row?.complementWarn, false);
    assert.match(row?.balanceLine ?? "", /1000/);
    assert.equal(documentHasUnpaidBalance(1000), true);
  });

  it("REP timbrado con saldo cero", () => {
    const row = billingListPpdCobranza({
      ...base,
      receivableBalance: 0,
      paymentComplementFiscalStatuses: ["TIMBRADA"],
      validatedApplicationComplementStatuses: [],
    });
    assert.equal(row?.complementLabel, "REP timbrado");
  });

  it("cobertura parcial", () => {
    const row = billingListPpdCobranza({
      ...base,
      receivableBalance: 500,
      paymentComplementFiscalStatuses: ["TIMBRADA"],
      validatedApplicationComplementStatuses: [],
    });
    assert.equal(row?.complementLabel, "Cobertura parcial");
  });

  it("REP pendiente con warn si elegible y saldo", () => {
    const row = billingListPpdCobranza({
      ...base,
      receivableBalance: 800,
      paymentComplementFiscalStatuses: [],
      validatedApplicationComplementStatuses: ["PENDIENTE"],
    });
    assert.equal(row?.complementLabel, "REP pendiente");
    assert.equal(row?.complementWarn, true);
  });
});