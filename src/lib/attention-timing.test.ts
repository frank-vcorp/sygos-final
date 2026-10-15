import assert from "node:assert/strict";
import test from "node:test";
import { attentionMetrics, elapsedLabel } from "./attention-timing";

const at = (hour: number) => new Date(`2026-10-15T${String(hour).padStart(2, "0")}:00:00.000Z`);

test("calcula las etapas desde los eventos operativos", () => {
  const metrics = attentionMetrics({
    attentionCreatedAt: at(8),
    receivedAt: at(9),
    operationEvents: [
      { action: "ASIGNACION", createdAt: at(10) },
      { action: "INICIO_TECNICO", createdAt: at(11) },
      { action: "CIERRE_TECNICO", createdAt: at(14) },
      { action: "VALIDACION", createdAt: at(16) },
    ],
    quoteCreatedAt: at(16),
    quoteEvents: [{ action: "PRECIO", createdAt: at(18) }],
    now: at(20),
  });
  assert.equal(metrics.find((metric) => metric.key === "total")?.milliseconds, 12 * 60 * 60 * 1000);
  assert.equal(metrics.find((metric) => metric.key === "beforeReceipt")?.milliseconds, 60 * 60 * 1000);
  assert.equal(metrics.find((metric) => metric.key === "technician")?.milliseconds, 3 * 60 * 60 * 1000);
  assert.equal(metrics.find((metric) => metric.key === "validation")?.milliseconds, 2 * 60 * 60 * 1000);
  assert.equal(metrics.find((metric) => metric.key === "pricing")?.milliseconds, 2 * 60 * 60 * 1000);
  assert.equal(metrics.find((metric) => metric.key === "clientDecision")?.milliseconds, 2 * 60 * 60 * 1000);
});

test("marca como estimado el tiempo histórico sin inicio técnico", () => {
  const metrics = attentionMetrics({
    attentionCreatedAt: at(8),
    receivedAt: at(9),
    operationEvents: [{ action: "ASIGNACION", createdAt: at(10) }],
    quoteCreatedAt: null,
    quoteEvents: [],
    now: at(12),
  });
  const technician = metrics.find((metric) => metric.key === "technician");
  assert.equal(technician?.milliseconds, 2 * 60 * 60 * 1000);
  assert.equal(technician?.estimated, true);
  assert.equal(elapsedLabel(26 * 60 * 60 * 1000), "1 d 2 h");
});
