"use client";

import { useState } from "react";
import { controlClass, Field, MoneyInput } from "@/components/ui";
import type { FinanceAccountKind } from "@/lib/finance-accounts";

export function FinanceAccountCreateFields({ showOpening = false }: { showOpening?: boolean }) {
  const [kind, setKind] = useState<FinanceAccountKind>("BANCARIA");
  return (
    <>
      <Field label="Tipo">
        <select
          name="kind"
          className={controlClass}
          value={kind}
          onChange={(event) => {
            const value = event.target.value;
            setKind(value === "EFECTIVO" || value === "CREDITO" ? value : "BANCARIA");
          }}
        >
          <option value="BANCARIA">Bancaria</option>
          <option value="EFECTIVO">Efectivo</option>
          <option value="CREDITO">Crédito (tarjeta)</option>
        </select>
      </Field>
      {kind === "EFECTIVO" ? (
        <Field label="Nombre" hint='Si queda vacío, se usa «Efectivo».'>
          <input name="cashName" className={controlClass} placeholder="Efectivo" />
        </Field>
      ) : (
        <>
          <Field label="Banco">
            <input name="bankName" required className={controlClass} />
          </Field>
          {kind === "BANCARIA" ? (
            <Field label="CLABE">
              <input name="clabe" required inputMode="numeric" autoComplete="off" className={controlClass} placeholder="18 dígitos" />
            </Field>
          ) : null}
          <Field label="Últimos 4" hint="Solo identificación de la tarjeta o cuenta de débito.">
            <input name="lastFour" inputMode="numeric" maxLength={4} className={controlClass} placeholder="1234" />
          </Field>
        </>
      )}
      <Field label="Fiscal">
        <select name="fiscal" defaultValue="no" className={controlClass}>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </select>
      </Field>
      {showOpening ? (
        <Field label="Saldo o deuda inicial">
          <MoneyInput name="opening" defaultValue="0" />
        </Field>
      ) : null}
    </>
  );
}
