"use client";

import { useState } from "react";
import { ExpenseCategorySubcategoryFields } from "@/components/expense-category-subcategory-fields";
import type { ExpenseCategoryCatalogItem } from "@/lib/expense-catalog";
import { Button, controlClass, Field, FormActions, FormSection, MoneyInput } from "@/components/ui";

type Account = { id: string; name: string; kind: string };
type IncomeCategory = { id: string; name: string };

export type ManualMovementDirectionMode = "ingreso" | "egreso" | "both";

export function movementFormCopy(directionMode: ManualMovementDirectionMode) {
  const description =
    directionMode === "ingreso"
      ? "Registra un ingreso en una cuenta del mes en curso."
      : directionMode === "egreso"
        ? "Registra un egreso en una cuenta del mes en curso."
        : "Registra ingreso o egreso en una cuenta del mes en curso.";
  const title = "Movimiento manual";
  return { title, description };
}

export function movementTriggerLabel(directionMode: ManualMovementDirectionMode) {
  if (directionMode === "ingreso") return "Registrar ingreso";
  if (directionMode === "egreso") return "Registrar egreso";
  return "Registrar movimiento";
}

export function ManualMovementFormFields({
  accounts,
  expenseCategories,
  incomeCategories,
  directionMode = "both",
}: {
  accounts: Account[];
  expenseCategories: ExpenseCategoryCatalogItem[];
  incomeCategories: IncomeCategory[];
  directionMode?: ManualMovementDirectionMode;
}) {
  const fixedDirection =
    directionMode === "ingreso" ? "INGRESO" : directionMode === "egreso" ? "EGRESO" : null;
  const [direction, setDirection] = useState<"EGRESO" | "INGRESO">(fixedDirection ?? "EGRESO");
  const effectiveDirection = fixedDirection ?? direction;
  const { title, description } = movementFormCopy(directionMode);

  return (
    <FormSection title={title} description={description}>
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
  );
}

export function ManualMovementFormActions({
  pending,
  onCancel,
}: {
  pending?: boolean;
  onCancel?: () => void;
}) {
  return (
    <FormActions>
      {onCancel ? (
        <Button type="button" tone="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Registrar"}
      </Button>
    </FormActions>
  );
}
