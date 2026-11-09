/** Tipos canónicos de cuenta de tesorería (después de migración). */
export const FINANCE_ACCOUNT_KINDS = ["BANCARIA", "EFECTIVO", "CREDITO"] as const;
export type FinanceAccountKind = (typeof FINANCE_ACCOUNT_KINDS)[number];

/** Formas de pago operativas unificadas (compras, egresos, tesorería). */
export const OPERATIONAL_PAYMENT_TYPES = ["EFECTIVO", "TRANSFERENCIA", "TD", "TC", "CREDITO"] as const;
export type OperationalPaymentType = (typeof OPERATIONAL_PAYMENT_TYPES)[number];

/** Crédito con proveedor (cuenta por pagar); no exige cuenta de tesorería al registrar. */
export const VENDOR_CREDIT_PAYMENT = "CREDITO" as const;

const LEGACY_KIND: Record<string, FinanceAccountKind> = {
  BANCO: "BANCARIA",
  BANCARIA: "BANCARIA",
  EFECTIVO: "EFECTIVO",
  TARJETA: "CREDITO",
  CREDITO: "CREDITO",
};

const LEGACY_PAYMENT: Record<string, OperationalPaymentType> = {
  CONTADO: "EFECTIVO",
  EFECTIVO: "EFECTIVO",
  TRANSFERENCIA: "TRANSFERENCIA",
  TD: "TD",
  TARJETA: "TC",
  TC: "TC",
  CREDITO: VENDOR_CREDIT_PAYMENT,
};

export function normalizeFinanceAccountKind(kind: string | null | undefined): FinanceAccountKind {
  const key = (kind ?? "").trim().toUpperCase();
  return LEGACY_KIND[key] ?? (FINANCE_ACCOUNT_KINDS.includes(key as FinanceAccountKind) ? (key as FinanceAccountKind) : "EFECTIVO");
}

export function financeAccountKindLabel(kind: string) {
  const normalized = normalizeFinanceAccountKind(kind);
  if (normalized === "BANCARIA") return "Bancaria";
  if (normalized === "EFECTIVO") return "Efectivo";
  if (normalized === "CREDITO") return "Crédito (tarjeta)";
  return kind;
}

export function isCreditCardAccountKind(kind: string) {
  return normalizeFinanceAccountKind(kind) === "CREDITO";
}

export function isBankAccountKind(kind: string) {
  return normalizeFinanceAccountKind(kind) === "BANCARIA";
}

export function isCashAccountKind(kind: string) {
  return normalizeFinanceAccountKind(kind) === "EFECTIVO";
}

export function financeAccountKindsForFilter(kinds: FinanceAccountKind | FinanceAccountKind[]) {
  const list = Array.isArray(kinds) ? kinds : [kinds];
  const expanded = new Set<string>();
  for (const kind of list) {
    expanded.add(kind);
    if (kind === "BANCARIA") expanded.add("BANCO");
    if (kind === "CREDITO") expanded.add("TARJETA");
  }
  return [...expanded];
}

export type FinanceAccountNameInput = {
  kind: string;
  name: string;
  bankName?: string | null;
  lastFour?: string | null;
};

export function formatAccountLastFour(lastFour?: string | null) {
  const digits = (lastFour ?? "").replace(/\D/g, "").slice(-4);
  return digits.length === 4 ? `····${digits}` : "";
}

export function financeAccountDisplayName(account: FinanceAccountNameInput): string {
  const kind = normalizeFinanceAccountKind(account.kind);
  if (kind === "BANCARIA" || kind === "CREDITO") {
    const bank = account.bankName?.trim();
    if (bank) return bank;
    const legacy = account.name.trim();
    return legacy.replace(/\s+····\d{4}$/, "").trim() || legacy;
  }
  const name = account.name.trim();
  return name || "Efectivo";
}

export function parseLastFour(value: FormDataEntryValue | string | null | undefined, { required = false } = {}): string | null {
  const digits = (typeof value === "string" ? value : "").replace(/\D/g, "");
  if (!digits) {
    if (required) throw new Error("Indica los últimos 4 dígitos de la tarjeta o cuenta.");
    return null;
  }
  if (!/^\d{4}$/.test(digits)) throw new Error("Los últimos 4 deben ser exactamente 4 dígitos.");
  return digits;
}

export function lastFourFromClabe(clabe?: string | null): string | null {
  const digits = (clabe ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function buildFinanceAccountStoredName(input: {
  kind: FinanceAccountKind;
  bankName?: string | null;
  lastFour?: string | null;
  clabe?: string | null;
  cashName?: string | null;
}): string {
  if (input.kind === "EFECTIVO") {
    const name = input.cashName?.trim();
    return name || "Efectivo";
  }
  const bank = input.bankName?.trim();
  if (!bank) throw new Error("Indica el nombre del banco.");
  return bank;
}

export function normalizeOperationalPaymentType(value: string | null | undefined): OperationalPaymentType {
  const key = (value ?? "").trim().toUpperCase();
  return LEGACY_PAYMENT[key] ?? (OPERATIONAL_PAYMENT_TYPES.includes(key as OperationalPaymentType) ? (key as OperationalPaymentType) : "EFECTIVO");
}

export function operationalPaymentTypeLabel(paymentType: string) {
  const normalized = normalizeOperationalPaymentType(paymentType);
  if (normalized === "EFECTIVO") return "Efectivo";
  if (normalized === "TRANSFERENCIA") return "Transferencia";
  if (normalized === "TD") return "Tarjeta de débito";
  if (normalized === "TC") return "Tarjeta de crédito";
  if (normalized === VENDOR_CREDIT_PAYMENT) return "Crédito con proveedor";
  return paymentType;
}

export function paymentTypeRequiresTreasuryAccount(paymentType: string) {
  const normalized = normalizeOperationalPaymentType(paymentType);
  return normalized !== VENDOR_CREDIT_PAYMENT;
}

/** @deprecated Usa paymentTypeRequiresTreasuryAccount */
export const accountRequiredForPayment = paymentTypeRequiresTreasuryAccount;

export function expectedFinanceAccountKindForPayment(paymentType: string): FinanceAccountKind | null {
  const normalized = normalizeOperationalPaymentType(paymentType);
  if (normalized === "EFECTIVO") return "EFECTIVO";
  if (normalized === "TRANSFERENCIA" || normalized === "TD") return "BANCARIA";
  if (normalized === "TC") return "CREDITO";
  return null;
}

export function assertPaymentMatchesAccountKind(paymentType: string, accountKind: string) {
  const expected = expectedFinanceAccountKindForPayment(paymentType);
  if (!expected) return;
  const actual = normalizeFinanceAccountKind(accountKind);
  if (actual !== expected) {
    throw new Error(
      `La forma de pago ${operationalPaymentTypeLabel(paymentType)} requiere una cuenta ${financeAccountKindLabel(expected)}.`,
    );
  }
}

export const treasuryAccountSelect = {
  id: true,
  name: true,
  kind: true,
  bankName: true,
  lastFour: true,
} as const;

export function mapTreasuryAccountOptions<T extends FinanceAccountNameInput & { id: string }>(accounts: T[]) {
  return accounts.map((account) => ({ ...account, name: financeAccountDisplayName(account) }));
}

export function parseFinanceAccountKindFromForm(value: FormDataEntryValue | null): FinanceAccountKind {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "EFECTIVO") return "EFECTIVO";
  if (raw === "CREDITO" || raw === "TARJETA") return "CREDITO";
  if (raw === "BANCARIA" || raw === "BANCO") return "BANCARIA";
  throw new Error("Selecciona un tipo de cuenta válido.");
}
