import { isBillingDocumentEligibleForRep } from "@/lib/facturapi";
import { paymentMethodLabel } from "@/lib/sat-payment-method";

/** Pendiente de pago es saldo por cobrar. PPD no cuenta como pagado. */
export function documentHasUnpaidBalance(balance: number | null | undefined): boolean {
  return typeof balance === "number" && Number.isFinite(balance) && balance > 0;
}

export function facturacionListUsesPaymentMethodColumn(role: string): boolean {
  return role === "COORDINACION_ADMINISTRACION" || role === "CEO";
}

function repStamped(fiscalStatus: string): boolean {
  return fiscalStatus === "TIMBRADA" || fiscalStatus === "SIMULADA";
}

function repActive(fiscalStatus: string): boolean {
  return fiscalStatus !== "CANCELADA";
}

export function paymentMethodShortListLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const full = paymentMethodLabel(code);
  const dash = full.indexOf(" — ");
  return dash >= 0 ? full.slice(0, dash) : full;
}

export type BillingListPpdCobranza = {
  balanceLine: string | null;
  complementLabel: string;
  complementWarn: boolean;
};

export function billingListPpdCobranza(input: {
  documentStatus: string;
  kind: string;
  paymentMethodSnapshot: string | null;
  fiscalStatus: string;
  receivableBalance: number | null | undefined;
  paymentComplementFiscalStatuses: string[];
  validatedApplicationComplementStatuses: Array<string | null | undefined>;
  formatBalance: (amount: number) => string;
}): BillingListPpdCobranza | null {
  if (input.paymentMethodSnapshot !== "PPD") return null;
  if (input.documentStatus !== "EMITIDA" || input.receivableBalance == null) {
    return { balanceLine: null, complementLabel: "—", complementWarn: false };
  }

  const itemReps = input.paymentComplementFiscalStatuses.filter(repActive);
  const appReps = input.validatedApplicationComplementStatuses
    .map((status) => status ?? "PENDIENTE")
    .filter(repActive);

  const stampedCount = [...itemReps, ...appReps].filter(repStamped).length;
  const pendingCount = itemReps.filter((s) => !repStamped(s)).length
    + appReps.filter((s) => !repStamped(s)).length;
  const hasValidatedApps = input.validatedApplicationComplementStatuses.length > 0;
  const hasAnyRepRow = itemReps.length > 0 || hasValidatedApps;

  let complementLabel = "Sin REP";
  if (!hasAnyRepRow) {
    complementLabel = "Sin REP";
  } else if (stampedCount > 0 && input.receivableBalance <= 0 && pendingCount === 0) {
    complementLabel = "REP timbrado";
  } else if (stampedCount > 0 && input.receivableBalance > 0) {
    complementLabel = "Cobertura parcial";
  } else if (pendingCount > 0 || (hasValidatedApps && stampedCount === 0)) {
    complementLabel = "REP pendiente";
  } else if (stampedCount > 0) {
    complementLabel = "REP timbrado";
  }

  const eligible = isBillingDocumentEligibleForRep({
    kind: input.kind,
    paymentMethodSnapshot: input.paymentMethodSnapshot,
    fiscalStatus: input.fiscalStatus,
  });

  return {
    balanceLine: `Saldo pendiente: ${input.formatBalance(input.receivableBalance)}`,
    complementLabel,
    complementWarn: complementLabel === "REP pendiente" && input.receivableBalance > 0 && eligible,
  };
}