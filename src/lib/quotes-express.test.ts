import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  quoteDeliveryDaysRequired,
  quoteListSlaLabel,
  quoteShowsDeliveryDaysField,
} from "./quotes";

const expressOsCase = { kind: "OS", attentionType: "REPARACION" };
const diagnosisCase = { kind: "DIAGNOSTICO", attentionType: "DIAGNOSTICO" };

describe("Reparación Express cotización", () => {
  it("tiempo de entrega opcional en OS express", () => {
    const quote = { quoteType: "REPARACION", technicalCaseId: "case-1" };
    assert.equal(quoteDeliveryDaysRequired(quote, expressOsCase), false);
    assert.equal(quoteShowsDeliveryDaysField(quote, expressOsCase), true);
  });

  it("sigue exigiendo días en reparación ligada a diagnóstico", () => {
    const quote = { quoteType: "REPARACION", technicalCaseId: "dx-1" };
    assert.equal(quoteDeliveryDaysRequired(quote, diagnosisCase), true);
  });

  it("columna SLA en cotizaciones: sin precio vs plazo vs cuenta regresiva", () => {
    const pending = quoteListSlaLabel({
      status: "PENDIENTE_COTIZAR",
      slaDueAt: null,
      deliveryBusinessDays: null,
      quoteType: "REPARACION",
      technicalCaseId: "c1",
    });
    assert.equal(pending.kind, "text");
    if (pending.kind === "text") assert.equal(pending.text, "Sin precio");

    const priced = quoteListSlaLabel({
      status: "PENDIENTE_DECISION",
      slaDueAt: null,
      deliveryBusinessDays: 5,
      quoteType: "REPARACION",
      technicalCaseId: "c1",
    });
    assert.equal(priced.kind, "text");
    if (priced.kind === "text") assert.equal(priced.text, "5 días hábiles");

    const due = new Date("2026-12-01T08:00:00-06:00");
    const countdown = quoteListSlaLabel({
      status: "AUTORIZADA",
      slaDueAt: due,
      deliveryBusinessDays: 5,
      quoteType: "REPARACION",
      technicalCaseId: "c1",
    });
    assert.equal(countdown.kind, "countdown");
    if (countdown.kind === "countdown") {
      assert.equal(countdown.dueAt.toISOString(), due.toISOString());
    }
  });
});
