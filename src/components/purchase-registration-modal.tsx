"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { phaseOnePurchaseAction } from "@/app/(erp)/compras/actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { SupplierPicker } from "@/components/supplier-picker";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput } from "@/components/ui";
import type { PickerOption } from "@/components/searchable-entity-picker";

type ExpenseCategoryOption = {
  id: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
};

type AccountOption = { id: string; name: string };

export function PurchaseRegistrationModal({
  suppliers,
  categories,
  accounts,
  allowQuickSupplier,
  initiallyOpen = false,
  returnHref = "/compras",
}: {
  suppliers: PickerOption[];
  categories: ExpenseCategoryOption[];
  accounts: AccountOption[];
  allowQuickSupplier: boolean;
  initiallyOpen?: boolean;
  returnHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [purchaseKind, setPurchaseKind] = useState<"GENERAL" | "REFACCION">("GENERAL");

  function close() {
    setOpen(false);
    if (initiallyOpen) router.replace(returnHref);
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>Registrar compra</Button>
      <FormOverlayDialog open={open} onClose={close} title="Registrar compra" titleId="registrar-compra-title" wide>
        <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
          Registra una compra urgente ya realizada, sin requerimiento ni lista. La moneda se hereda del proveedor.
        </p>
        <FormPanel action={phaseOnePurchaseAction} className="max-w-none">
          <input type="hidden" name="purchaseKind" value={purchaseKind} />
          <FormSection title="Datos de la compra" description="Captura solo la información administrativa y financiera necesaria.">
            <div className="md:col-span-2">
              <SupplierPicker suppliers={suppliers} required allowQuickSupplier={allowQuickSupplier} />
            </div>
            <Field label="Tipo de compra">
              <select
                name="purchaseKindSelector"
                value={purchaseKind}
                onChange={(event) => setPurchaseKind(event.target.value as "GENERAL" | "REFACCION")}
                className={controlClass}
              >
                <option value="GENERAL">General</option>
                <option value="REFACCION">Refacciones</option>
              </select>
            </Field>
            <Field label="Fecha de compra">
              <input name="purchaseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={controlClass} />
            </Field>
            <Field label="Monto" hint="Se guarda en la moneda configurada para el proveedor.">
              <MoneyInput name="amount" required min="0.01" />
            </Field>
            <Field label="Descripción general" hint={purchaseKind === "REFACCION" ? "Sugerida para compras de refacciones; puedes ajustarla." : "Describe la compra para su registro administrativo."}>
              <input
                key={purchaseKind}
                name="concept"
                required
                defaultValue={purchaseKind === "REFACCION" ? "Compra de refacciones y componentes" : ""}
                className={controlClass}
              />
            </Field>
            {purchaseKind === "REFACCION" ? (
              <div className="md:col-span-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm">
                <span className="text-[var(--muted)]">Clasificación de egreso</span>
                <strong className="ml-2">Producción y operación · Refacciones y componentes</strong>
              </div>
            ) : (
              <>
                <Field label="Categoría de egreso">
                  <select name="expenseCategoryId" defaultValue="" required className={controlClass}>
                    <option value="" disabled>Selecciona una categoría</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </Field>
                <Field label="Subcategoría">
                  <select name="expenseSubcategoryId" defaultValue="" className={controlClass}>
                    <option value="">Sin subcategoría</option>
                    {categories.flatMap((category) => category.subcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>{category.name} · {subcategory.name}</option>
                    )))}
                  </select>
                </Field>
              </>
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
            <details className="group md:col-span-2 rounded-lg border border-[var(--line)] bg-[#f8fbfd]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--ink)] [&::-webkit-details-marker]:hidden">
                <span>Agregar detalle técnico opcional</span>
                <span className="text-xs text-[var(--muted)] transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="grid gap-4 border-t border-[var(--line)] p-4 sm:grid-cols-3">
                <Field label="Número de parte"><input name="partNumber" className={controlClass} /></Field>
                <Field label="Descripción"><input name="description" className={controlClass} /></Field>
                <Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue="1" className={controlClass} /></Field>
              </div>
            </details>
          </FormSection>
          <FormActions note="La compra quedará lista para el flujo administrativo existente.">
            <Button type="submit">Guardar compra realizada</Button>
          </FormActions>
        </FormPanel>
      </FormOverlayDialog>
    </>
  );
}
