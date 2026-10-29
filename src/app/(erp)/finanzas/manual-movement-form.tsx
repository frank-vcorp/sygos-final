"use client";

import { useState } from "react";
import { movementAction } from "./actions";
import { ExpenseCategorySubcategoryFields } from "@/components/expense-category-subcategory-fields";
import type { ExpenseCategoryCatalogItem } from "@/lib/expense-catalog";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput } from "@/components/ui";

type Account = { id: string; name: string; kind: string };
type IncomeCategory = { id: string; name: string };

export type ManualMovementDirectionMode = "ingreso" | "egreso" | "both";

export function ManualMovementForm({
  accounts,
  expenseCategories,
  incomeCategories,
  directionMode = "both",
  className = "",
}: {
  accounts: Account[];
  expenseCategories: ExpenseCategoryCatalogItem[];
  incomeCategories: IncomeCategory[];
  directionMode?: ManualMovementDirectionMode;
  className?: string;
}) {
  const fixedDirection =
    directionMode === "ingreso" ? "INGRESO" : directionMode === "egreso" ? "EGRESO" : null;
  const [direction, setDirection] = useState<"EGRESO" | "INGRESO">(fixedDirection ?? "EGRESO");
  const effectiveDirection = fixedDirection ?? direction;
  const description =
    directionMode === "ingreso"
      ? "Registra un ingreso en una cuenta del mes en curso."
      : directionMode === "egreso"
        ? "Registra un egreso en una cuenta del mes en curso."
        : "Registra ingreso o egreso en una cuenta del mes en curso.";

  return (
    <FormPanel action={movementAction} className={className}>
      <FormSection title="Movimiento manual" description={description}>
        <Field label="Cuenta">
          <select name="accountId" className={controlClass}>{accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        </Field>
        {fixedDirection ? (
          <input type="hidden" name="direction" value={fixedDirection} />
        ) : (
          <Field label="Dirección">
            <select
              name="direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value === "INGRESO" ? "INGRESO" : "EGRESO")}
              className={controlClass}
            >
              <option value="EGRESO">Egreso</option>
              <option value="INGRESO">Ingreso</option>
            </select>
          </Field>
        )}
        <Field label="Importe"><MoneyInput name="amount" min="0.01" required /></Field>
        {effectiveDirection === "INGRESO" ? (
          <Field label="Categoría de ingreso">
            <select name="incomeCategoryId" required className={controlClass} defaultValue="">
              <option value="" disabled>Selecciona una categoría</option>
              {incomeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </Field>
        ) : (
          <ExpenseCategorySubcategoryFields categories={expenseCategories} />
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
