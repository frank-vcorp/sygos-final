"use client";

import { useMemo, useState } from "react";
import { ExpenseCategorySubcategoryFields } from "@/components/expense-category-subcategory-fields";
import { SupplierPicker } from "@/components/supplier-picker";
import { controlClass, Field, FormSection, MoneyInput } from "@/components/ui";
import type { ExpenseCategoryCatalogItem } from "@/lib/expense-catalog";
import type { PickerOption } from "@/components/searchable-entity-picker";

export type SupplierWithCurrency = PickerOption & { currency: string };

export function RequirementPurchaseFormFields({
  suppliers,
  categories,
  accounts,
  allowQuickSupplier,
  refaccion,
  fixedSupplierId = null,
  fixedSupplierName = null,
  supplierRequired = true,
}: {
  suppliers: SupplierWithCurrency[];
  categories: ExpenseCategoryCatalogItem[];
  accounts: Array<{ id: string; name: string }>;
  allowQuickSupplier: boolean;
  refaccion: boolean;
  fixedSupplierId?: string | null;
  fixedSupplierName?: string | null;
  supplierRequired?: boolean;
}) {
  const [supplierId, setSupplierId] = useState(fixedSupplierId ?? "");
  const currency = useMemo(
    () => suppliers.find((row) => row.id === (fixedSupplierId || supplierId))?.currency ?? "MXN",
    [fixedSupplierId, supplierId, suppliers],
  );

  return (
    <FormSection title="Datos de compra" description="La moneda se hereda del proveedor. La fecha de compra se registra al guardar.">
      {fixedSupplierId ? (
        <div className="md:col-span-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm">
          <input type="hidden" name="supplierId" value={fixedSupplierId} />
          <span className="text-[var(--muted)]">Proveedor</span>
          <strong className="ml-2">{fixedSupplierName ?? "—"}</strong>
        </div>
      ) : (
        <div className="md:col-span-2">
          <SupplierPicker
            suppliers={suppliers}
            required={supplierRequired}
            allowQuickSupplier={allowQuickSupplier}
            onSupplierChange={setSupplierId}
          />
        </div>
      )}
      <Field label="Monto" hint={`Importe en ${currency}.`}>
        <MoneyInput key={currency} name="amount" currency={currency} min="0.01" required />
      </Field>
      {!refaccion ? <ExpenseCategorySubcategoryFields categories={categories} /> : null}
      <Field label="Forma de pago">
        <select name="paymentType" defaultValue="CONTADO" className={controlClass}>
          <option value="CONTADO">Contado</option>
          <option value="CREDITO">Crédito</option>
          <option value="TARJETA">Tarjeta</option>
          <option value="TRANSFERENCIA">Transferencia</option>
        </select>
      </Field>
      <Field label="Banco / cuenta, si aplica">
        <select name="accountId" defaultValue="" className={controlClass}>
          <option value="">No aplica</option>
          {accounts.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </Field>
    </FormSection>
  );
}
