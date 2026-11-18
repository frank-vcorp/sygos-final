export function fiscalBadgeInfo(doc: {
  kind: string;
  fiscalStatus: string;
  fiscalEnv?: string | null;
  cancellationStatus?: string | null;
}): { label: string; tone: "neutral" | "ok" | "warn" | "danger" } | null {
  if (doc.kind === "REMISION" || doc.fiscalStatus === "NO_APLICA") return null;
  if (doc.fiscalStatus === "CANCELADA") {
    return { label: "Cancelada SAT", tone: "danger" };
  }
  if (doc.cancellationStatus === "pending" || doc.cancellationStatus === "verifying") {
    return {
      label:
        doc.cancellationStatus === "pending"
          ? "Cancelación en proceso (esperando receptor/SAT)"
          : "Cancelación en proceso (validando SAT)",
      tone: "warn",
    };
  }
  if (doc.cancellationStatus === "rejected") {
    return { label: "Cancelación rechazada", tone: "danger" };
  }
  if (doc.cancellationStatus === "expired") {
    return { label: "Cancelación expirada", tone: "warn" };
  }
  if (doc.fiscalStatus === "TIMBRADA") {
    if (doc.fiscalEnv === "TEST") {
      return { label: "TIMBRE DE PRUEBA (SANDBOX)", tone: "warn" };
    }
    return { label: "Timbrada SAT", tone: "ok" };
  }
  if (doc.fiscalStatus === "PROCESANDO") {
    return {
      label: doc.fiscalEnv === "TEST" ? "Procesando (202 · Sandbox)" : "Procesando SAT (202)",
      tone: "warn",
    };
  }
  if (doc.fiscalStatus === "SIMULADA") return { label: "Simulada (Modo pruebas)", tone: "warn" };
  if (doc.fiscalStatus === "ERROR") return { label: "Error fiscal", tone: "danger" };
  return { label: "Pendiente timbrado", tone: "neutral" };
}

export function repBadgeInfo(rep: {
  fiscalStatus: string;
  fiscalEnv?: string | null;
  cancellationStatus?: string | null;
}): { label: string; tone: "neutral" | "ok" | "warn" | "danger" } {
  if (rep.fiscalStatus === "CANCELADA") return { label: "REP Cancelado", tone: "danger" };
  if (rep.cancellationStatus === "pending" || rep.cancellationStatus === "verifying") {
    return { label: "REP cancelación en proceso", tone: "warn" };
  }
  if (rep.cancellationStatus === "rejected") {
    return { label: "Cancelación REP rechazada", tone: "danger" };
  }
  if (rep.fiscalStatus === "TIMBRADA") {
    if (rep.fiscalEnv === "TEST") {
      return { label: "TIMBRE DE PRUEBA (SANDBOX)", tone: "warn" };
    }
    return { label: "REP Timbrado SAT", tone: "ok" };
  }
  if (rep.fiscalStatus === "PROCESANDO") {
    return {
      label: rep.fiscalEnv === "TEST" ? "REP Procesando (202 · Sandbox)" : "REP Procesando SAT (202)",
      tone: "warn",
    };
  }
  if (rep.fiscalStatus === "SIMULADA") return { label: "REP Simulado (Modo pruebas)", tone: "warn" };
  if (rep.fiscalStatus === "ERROR") return { label: "Error REP", tone: "danger" };
  return { label: "REP Pendiente", tone: "neutral" };
}
