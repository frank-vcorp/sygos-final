"use client";

import { useState } from "react";
import { phaseOnePurchaseAction } from "../actions";
import { PurchaseLinesField } from "@/components/purchase-lines-field";
import { ExpenseCategorySubcategoryFields } from "@/components/expense-category-subcategory-fields";
import { SupplierPicker } from "@/components/supplier-picker";
import { Button, controlClass, Field, FormPanel } from "@/components/ui";
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
    <FormPanel action={phaseOnePurchaseAction} className="max-w-none border-0 shadow-none">
      <input type="hidden" name="order" value="si" />
      <input type="hidden" name="purchaseKind" value={purchaseKind} />
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-start">
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
          <SupplierPicker
            suppliers={suppliers}
            allowQuickSupplier={allowQuickSupplier}
            required
            hint=""
          />
        </div>

        <PurchaseLinesField requirePartNumber={refaccion} showUnitPrice compact />

        {refaccion ? (
          <p className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
            Clasificación: <strong className="text-[var(--ink)]">Producción y operación · Refacciones y componentes</strong>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <ExpenseCategorySubcategoryFields categories={categories} />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Forma de pago">
            <select name="paymentType" required className={controlClass} defaultValue="CONTADO">
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
              <option value="TARJETA">Tarjeta</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </Field>
          <Field label="Banco / cuenta">
            <select name="accountId" defaultValue="" className={controlClass}>
              <option value="">No aplica</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-[var(--muted)]">
            El total se calcula con cantidad × precio unitario de cada partida.
          </p>
          <Button type="submit" className="shrink-0">Enviar O.C. a autorización</Button>
        </div>
      </div>
    </FormPanel>
  );
}
