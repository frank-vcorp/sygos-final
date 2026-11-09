"use client";

import { useMemo, useState } from "react";
import { controlClass, Field } from "@/components/ui";
import {
  expectedFinanceAccountKindForPayment,
  financeAccountDisplayName,
  normalizeFinanceAccountKind,
  normalizeOperationalPaymentType,
  paymentTypeRequiresTreasuryAccount,
} from "@/lib/finance-accounts";

export type TreasuryAccountOption = {
  id: string;
  name: string;
  kind: string;
  bankName?: string | null;
  lastFour?: string | null;
};

function accountLabel(account: TreasuryAccountOption) {
  return financeAccountDisplayName(account);
}

export function OperationalPaymentFields({
  accounts,
  paymentTypeName = "paymentType",
  accountIdName = "accountId",
  defaultPaymentType = "EFECTIVO",
  includeVendorCredit = true,
}: {
  accounts: TreasuryAccountOption[];
  paymentTypeName?: string;
  accountIdName?: string;
  defaultPaymentType?: string;
  includeVendorCredit?: boolean;
}) {
  const [paymentType, setPaymentType] = useState(() => normalizeOperationalPaymentType(defaultPaymentType));
  const expectedKind = expectedFinanceAccountKindForPayment(paymentType);
  const filteredAccounts = useMemo(() => {
    if (!expectedKind) return [];
    return accounts.filter((row) => normalizeFinanceAccountKind(row.kind) === expectedKind);
  }, [accounts, expectedKind]);
  const needsAccount = paymentTypeRequiresTreasuryAccount(paymentType);

  return (
    <>
      <Field label="Forma de pago">
        <select
          name={paymentTypeName}
          required
          className={controlClass}
          value={paymentType}
          onChange={(event) => setPaymentType(normalizeOperationalPaymentType(event.target.value))}
        >
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="TD">Tarjeta de débito</option>
          <option value="TC">Tarjeta de crédito</option>
          {includeVendorCredit ? <option value="CREDITO">Crédito con proveedor</option> : null}
        </select>
      </Field>
      <Field label={needsAccount ? "Cuenta de tesorería" : "Cuenta de tesorería, si aplica"} hint={needsAccount ? "Obligatoria para esta forma de pago." : undefined}>
        <select name={accountIdName} className={controlClass} defaultValue="" required={needsAccount} disabled={!needsAccount}>
          {!needsAccount ? <option value="">No aplica</option> : <option value="" disabled>Selecciona…</option>}
          {filteredAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {accountLabel(account)}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}
