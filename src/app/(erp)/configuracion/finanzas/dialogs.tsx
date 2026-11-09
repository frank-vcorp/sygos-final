"use client";

import { useState } from "react";
import { createFinanceAccountAction, saveExpenseCategoryAction, saveExpenseSubcategoryAction, saveIncomeCategoryAction } from "../ceo-actions";
import { CreateDialog } from "../create-dialog";
import { FinanceAccountCreateFields } from "@/components/finance-account-form-fields";
import { Button, controlClass, Field, FormActions, FormSection } from "@/components/ui";

function Keep({ name, value }: { name: string; value?: string }) {
  if (!value) return null;
  return <input type="hidden" name={name} value={value} />;
}

export function NewAccountDialog({ companyId, q, tipo }: { companyId: string; q?: string; tipo?: string }) {
  return (
    <CreateDialog label="Nueva cuenta" title="Nueva cuenta" titleId="nueva-cuenta">
      <AccountCreateForm companyId={companyId} q={q} tipo={tipo} />
    </CreateDialog>
  );
}

function AccountCreateForm({ companyId, q, tipo }: { companyId: string; q?: string; tipo?: string }) {
  return (
    <form action={createFinanceAccountAction}>
      <input type="hidden" name="companyId" value={companyId} />
      <Keep name="q" value={q} />
      <Keep name="tipo" value={tipo} />
      <FormSection title="Datos de la cuenta" description="Bancaria: banco, CLABE y últimos 4. Efectivo: nombre. Crédito: banco y últimos 4 (deuda)." columns={1}>
        <FinanceAccountCreateFields />
      </FormSection>
      <FormActions>
        <Button type="submit">Crear cuenta</Button>
      </FormActions>
    </form>
  );
}

export function NewCatalogDialog({
  categories,
  q,
  tipo,
}: {
  categories: Array<{ id: string; name: string }>;
  q?: string;
  tipo?: string;
}) {
  return (
    <CreateDialog label="Nuevo" title="Nuevo concepto" titleId="nuevo-catalogo">
      <CatalogCreateForm categories={categories} q={q} tipo={tipo} />
    </CreateDialog>
  );
}

function CatalogCreateForm({
  categories,
  q,
  tipo,
}: {
  categories: Array<{ id: string; name: string }>;
  q?: string;
  tipo?: string;
}) {
  const [clase, setClase] = useState<"ingreso" | "egreso" | "sub">("ingreso");
  const action = clase === "ingreso"
    ? saveIncomeCategoryAction
    : clase === "egreso"
      ? saveExpenseCategoryAction
      : saveExpenseSubcategoryAction;
  return (
    <form action={action}>
      <Keep name="q" value={q} />
      <Keep name="tipo" value={tipo} />
      <FormSection title="Concepto del catálogo" description="La subcategoría queda dentro de la categoría de egreso que elijas." columns={1}>
        <Field label="Tipo">
          <select
            value={clase}
            onChange={(event) => {
              const next = event.target.value;
              setClase(next === "egreso" || next === "sub" ? next : "ingreso");
            }}
            className={controlClass}
          >
            <option value="ingreso">Categoría de ingreso</option>
            <option value="egreso">Categoría de egreso</option>
            <option value="sub" disabled={categories.length === 0}>Subcategoría de egreso</option>
          </select>
        </Field>
        {clase === "sub" ? (
          <Field label="Categoría">
            <select name="categoryId" required className={controlClass} defaultValue={categories[0]?.id ?? ""}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Nombre">
          <input name="name" required autoFocus className={controlClass} />
        </Field>
      </FormSection>
      <FormActions>
        <Button type="submit">{clase === "sub" ? "Crear subcategoría" : "Crear categoría"}</Button>
      </FormActions>
    </form>
  );
}
