"use client";

import { useState } from "react";
import { createFinanceAccountAction } from "../ceo-actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";

export function NewAccountForm() {
  const [kind, setKind] = useState<"BANCO" | "EFECTIVO">("BANCO");
  const bank = kind === "BANCO";
  return (
    <FormPanel action={createFinanceAccountAction}>
      <FormSection
        title="Nueva cuenta"
        description="Cuenta bancaria pide banco y CLABE. Efectivo no."
      >
        <Field label="Tipo">
          <select name="kind" value={kind} onChange={(event) => setKind(event.target.value === "EFECTIVO" ? "EFECTIVO" : "BANCO")} className={controlClass}>
            <option value="BANCO">Cuenta bancaria</option>
            <option value="EFECTIVO">Efectivo</option>
          </select>
        </Field>
        <Field label="Fiscal">
          <select name="fiscal" defaultValue="no" className={controlClass}>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </Field>
        {bank ? (
          <>
            <Field label="Nombre del banco">
              <input name="bankName" required className={controlClass} />
            </Field>
            <Field label="CLABE">
              <input name="clabe" required inputMode="numeric" autoComplete="off" className={controlClass} placeholder="18 dígitos" />
            </Field>
          </>
        ) : (
          <Field label="Nombre">
            <input name="name" required className={controlClass} placeholder="Caja" />
          </Field>
        )}
      </FormSection>
      <FormActions>
        <Button type="submit">Crear cuenta</Button>
      </FormActions>
    </FormPanel>
  );
}
