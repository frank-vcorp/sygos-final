export type TimedHistoryEvent = {
  action: string;
  createdAt: Date;
};

export type AttentionMetric = {
  key: "total" | "beforeReceipt" | "technician" | "validation" | "pricing" | "clientDecision";
  label: string;
  milliseconds: number;
  active: boolean;
  estimated?: boolean;
};

const nonNegative = (from: Date, to: Date) => Math.max(0, to.getTime() - from.getTime());

/**
 * Turns the operational audit trail into durations. Existing cases without an
 * INICIO_TECNICO event use their assignment time as an explicitly marked estimate.
 */
export function attentionMetrics(input: {
  attentionCreatedAt: Date;
  receivedAt: Date | null;
  operationEvents: TimedHistoryEvent[];
  quoteCreatedAt: Date | null;
  quoteEvents: TimedHistoryEvent[];
  now?: Date;
}): AttentionMetric[] {
  const now = input.now ?? new Date();
  const events = [...input.operationEvents].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const quoteEvents = [...input.quoteEvents].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let technicianStartedAt: Date | null = null;
  let technicianElapsed = 0;
  let currentTechnicianEstimated = false;
  let hasEstimatedTechnicianPeriod = false;
  let validationStartedAt: Date | null = null;
  let validationElapsed = 0;

  for (const event of events) {
    if (event.action === "ASIGNACION" && !technicianStartedAt) {
      technicianStartedAt = event.createdAt;
      currentTechnicianEstimated = true;
    }
    if (event.action === "INICIO_TECNICO" || event.action === "REAPERTURA") {
      technicianStartedAt = event.createdAt;
      currentTechnicianEstimated = false;
    }
    if (event.action === "CIERRE_TECNICO") {
      if (technicianStartedAt) technicianElapsed += nonNegative(technicianStartedAt, event.createdAt);
      if (technicianStartedAt && currentTechnicianEstimated) hasEstimatedTechnicianPeriod = true;
      technicianStartedAt = null;
      currentTechnicianEstimated = false;
      validationStartedAt = event.createdAt;
    }
    if (event.action === "DEVOLUCION" || event.action === "VALIDACION") {
      if (validationStartedAt) validationElapsed += nonNegative(validationStartedAt, event.createdAt);
      validationStartedAt = null;
    }
  }

  if (technicianStartedAt) technicianElapsed += nonNegative(technicianStartedAt, now);
  if (technicianStartedAt && currentTechnicianEstimated) hasEstimatedTechnicianPeriod = true;
  if (validationStartedAt) validationElapsed += nonNegative(validationStartedAt, now);

  const priceEvent = quoteEvents.find((event) => event.action === "PRECIO");
  const decisionEvent = quoteEvents.find((event) => event.action === "DECISION");
  const pricingStart = input.quoteCreatedAt;
  const pricingEnd = priceEvent?.createdAt ?? now;
  const decisionStart = priceEvent?.createdAt ?? null;
  const decisionEnd = decisionEvent?.createdAt ?? now;

  return [
    { key: "total", label: "Atención total", milliseconds: nonNegative(input.attentionCreatedAt, now), active: true },
    {
      key: "beforeReceipt",
      label: input.receivedAt ? "Antes de entrada física" : "Pendiente de entrada física",
      milliseconds: nonNegative(input.attentionCreatedAt, input.receivedAt ?? now),
      active: !input.receivedAt,
    },
    {
      key: "technician",
      label: "Con técnico",
      milliseconds: technicianElapsed,
      active: Boolean(technicianStartedAt),
      estimated: hasEstimatedTechnicianPeriod,
    },
    {
      key: "validation",
      label: "Pendiente de validación",
      milliseconds: validationElapsed,
      active: Boolean(validationStartedAt),
    },
    {
      key: "pricing",
      label: "Pendiente de cotización",
      milliseconds: pricingStart ? nonNegative(pricingStart, pricingEnd) : 0,
      active: Boolean(pricingStart && !priceEvent),
    },
    {
      key: "clientDecision",
      label: "Pendiente de decisión del cliente",
      milliseconds: decisionStart ? nonNegative(decisionStart, decisionEnd) : 0,
      active: Boolean(decisionStart && !decisionEvent),
    },
  ];
}

export function elapsedLabel(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}
