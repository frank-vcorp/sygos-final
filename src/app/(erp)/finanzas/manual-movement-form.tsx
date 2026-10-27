"use client";

import { useState } from "react";
import { movementAction } from "./actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput } from "@/components/ui";

type Account = { id: string; name: string; kind: string };
type ExpenseCategory = { id: string; name: string; subcategories: Array<{ id: string; name: string }> };
type IncomeCategory = { id: string; name: string };

export function ManualMovementForm({
  accounts,
  expenseCategories,
  incomeCategories,
  className = "",
}: {
  accounts: Account[];
  expenseCategories: ExpenseCategory[];
  incomeCategories: IncomeCategory[];
  className?: string;
}) {
  const [direction, setDirection] = useState<"EGRESO" | "INGRESO">("EGRESO");
  return (
    <FormPanel action={movementAction} className={className}>
      <FormSection title="Movimiento manual" description="Registra ingreso o egreso en una cuenta del mes en curso.">
        <Field label="Cuenta">
          <select name="accountId" className={controlClass}>{accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        </Field>
        <Field label="Dirección">
          <select name="direction" value={direction} onChange={(event) => setDirection(event.target.value === "INGRESO" ? "INGRESO" : "EGRESO")} className={controlClass}>
            <option value="EGRESO">Egreso</option>
            <option value="INGRESO">Ingreso</option>
          </select>
        </Field>
        <Field label="Importe"><MoneyInput name="amount" min="0.01" required /></Field>
        {direction === "INGRESO" ? (
          <Field label="Categoría de ingreso">
            <select name="incomeCategoryId" required className={controlClass} defaultValue="">
              <option value="" disabled>Selecciona una categoría</option>
              {incomeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </Field>
        ) : (
          <>
            <Field label="Categoría de egreso">
              <select name="expenseCategoryId" required className={controlClass} defaultValue="">
                <option value="" disabled>Selecciona una categoría</option>
                {expenseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Subcategoría (opcional)">
              <select name="expenseSubcategoryId" className={controlClass} defaultValue="">
                <option value="">Sin subcategoría</option>
                {expenseCategories.flatMap((category) => category.subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>{category.name} · {subcategory.name}</option>
                )))}
              </select>
            </Field>
          </>
        )}
        <Field label="Nota"><input name="note" required className={controlClass} /></Field>
        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="pendingProof" value="si" /> Pendiente de comprobación
          </label>
        </div>
      </FormSection>
      <FormActions><Button type="submit">Registrar</Button></FormActions>
    </FormPanel>
  );
}
