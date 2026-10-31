"use client";

import { useState } from "react";
import { createFinanceAccountAction, saveExpenseCategoryAction, saveExpenseSubcategoryAction, saveIncomeCategoryAction } from "../ceo-actions";
import { CreateDialog } from "../create-dialog";
import { Button, controlClass, Field, FormActions, FormSection } from "@/components/ui";

function Keep({ name, value }: { name: string; value?: string }) {
  if (!value) return null;
  return <input type="hidden" name={name} value={value} />;
}

export function NewAccountDialog({ q, tipo }: { q?: string; tipo?: string }) {
  return (
    <CreateDialog label="Nueva cuenta" title="Nueva cuenta" titleId="nueva-cuenta">
      <AccountCreateForm q={q} tipo={tipo} />
    </CreateDialog>
  );
}

function AccountCreateForm({ q, tipo }: { q?: string; tipo?: string }) {
  const [kind, setKind] = useState<"BANCO" | "EFECTIVO">("BANCO");
  const bank = kind === "BANCO";
  return (
    <form action={createFinanceAccountAction}>
      <Keep name="q" value={q} />
      <Keep name="tipo" value={tipo} />
      <FormSection title="Datos de la cuenta" description="La cuenta bancaria pide banco y CLABE. Efectivo no. El saldo inicia en cero." columns={1}>
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
              <input name="bankName" required autoFocus className={controlClass} />
            </Field>
            <Field label="CLABE">
              <input name="clabe" required inputMode="numeric" autoComplete="off" className={controlClass} placeholder="18 dígitos" />
            </Field>
          </>
        ) : (
          <Field label="Nombre">
            <input name="name" required autoFocus className={controlClass} placeholder="Caja" />
          </Field>
        )}
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
  estado,
}: {
  categories: Array<{ id: string; name: string }>;
  q?: string;
  tipo?: string;
  estado?: string;
}) {
  return (
    <CreateDialog label="Nuevo" title="Nuevo concepto" titleId="nuevo-catalogo">
      <CatalogCreateForm categories={categories} q={q} tipo={tipo} estado={estado} />
    </CreateDialog>
  );
}

function CatalogCreateForm({
  categories,
  q,
  tipo,
  estado,
}: {
  categories: Array<{ id: string; name: string }>;
  q?: string;
  tipo?: string;
  estado?: string;
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
      <Keep name="estado" value={estado} />
      <FormSection title="Concepto del catálogo" description="Ingresos, egresos y subcategorías de egreso viven en la misma lista." columns={1}>
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
        <Field label="Estado">
          <select name="active" defaultValue="si" className={controlClass}>
            <option value="si">Activa</option>
            <option value="no">Inactiva</option>
          </select>
        </Field>
      </FormSection>
      <FormActions>
        <Button type="submit">{clase === "sub" ? "Crear subcategoría" : "Crear categoría"}</Button>
      </FormActions>
    </form>
  );
}
