"use client";

import { useState } from "react";
import { phaseOnePurchaseAction } from "../actions";
import { PurchaseLinesField } from "@/components/purchase-lines-field";
import { ExpenseCategorySubcategoryFields } from "@/components/expense-category-subcategory-fields";
import { SupplierPicker } from "@/components/supplier-picker";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";
import type { ExpenseCategoryCatalogItem } from "@/lib/expense-catalog";
import type { PickerOption } from "@/components/searchable-entity-picker";

export function PurchaseOrderForm({
  suppliers,
  categories,
  accounts,
  allowQuickSupplier,
}: {
  suppliers: PickerOption[];
  categories: ExpenseCategoryCatalogItem[];
  accounts: Array<{ id: string; name: string }>;
  allowQuickSupplier: boolean;
}) {
  const [purchaseKind, setPurchaseKind] = useState<"GENERAL" | "REFACCION">("GENERAL");
  const refaccion = purchaseKind === "REFACCION";

  return (
    <FormPanel action={phaseOnePurchaseAction}>
      <input type="hidden" name="order" value="si" />
      <input type="hidden" name="purchaseKind" value={purchaseKind} />
      <FormSection title="Orden de compra" description="Se enviará a autorización del CEO con el total de las partidas.">
        <Field label="Tipo">
          <select
            value={purchaseKind}
            onChange={(event) => setPurchaseKind(event.target.value === "REFACCION" ? "REFACCION" : "GENERAL")}
            className={controlClass}
          >
            <option value="GENERAL">General</option>
            <option value="REFACCION">Refacción</option>
          </select>
        </Field>
        <div className="md:col-span-2">
          <SupplierPicker suppliers={suppliers} allowQuickSupplier={allowQuickSupplier} required />
        </div>
        <PurchaseLinesField requirePartNumber={refaccion} showUnitPrice />
        {refaccion ? (
          <div className="md:col-span-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm">
            <span className="text-[var(--muted)]">Clasificación de egreso</span>
            <strong className="ml-2">Producción y operación · Refacciones y componentes</strong>
          </div>
        ) : (
          <ExpenseCategorySubcategoryFields categories={categories} />
        )}
        <Field label="Forma de pago">
          <select name="paymentType" required className={controlClass} defaultValue="CONTADO">
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
            <option value="TARJETA">Tarjeta</option>
            <option value="TRANSFERENCIA">Transferencia</option>
          </select>
        </Field>
        <Field label="Banco / cuenta, si aplica">
          <select name="accountId" defaultValue="" className={controlClass}>
            <option value="">No aplica</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </Field>
      </FormSection>
      <FormActions note="El importe total se calcula a partir de cantidad × precio unitario de cada partida.">
        <Button type="submit">Enviar O.C. a autorización</Button>
      </FormActions>
    </FormPanel>
  );
}
