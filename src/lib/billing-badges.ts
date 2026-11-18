export function fiscalBadgeInfo(doc: {
  kind: string;
  fiscalStatus: string;
  fiscalEnv?: string | null;
}): { label: string; tone: "neutral" | "ok" | "warn" | "danger" } | null {
  if (doc.kind === "REMISION" || doc.fiscalStatus === "NO_APLICA") return null;
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
  if (doc.fiscalStatus === "CANCELADA") return { label: "Cancelada SAT", tone: "danger" };
  return { label: "Pendiente timbrado", tone: "neutral" };
}
