"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { convertShoppingListOverlayAction, type RequirementOverlayState } from "../actions";
import { RequirementPurchaseFormFields, type SupplierWithCurrency } from "../requerimientos/requirement-purchase-form-fields";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, FormActions } from "@/components/ui";
import type { ExpenseCategoryCatalogItem } from "@/lib/expense-catalog";

const overlayInitial: RequirementOverlayState = { status: "idle" };

export function ShoppingListPurchaseDialog({
  listId,
  listFolio,
  refaccion,
  supplierId,
  supplierName,
  suppliers,
  categories,
  accounts,
  allowQuickSupplier,
  onClose,
}: {
  listId: string;
  listFolio: string;
  refaccion: boolean;
  supplierId: string | null;
  supplierName: string | null;
  suppliers: SupplierWithCurrency[];
  categories: ExpenseCategoryCatalogItem[];
  accounts: Array<{ id: string; name: string }>;
  allowQuickSupplier: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(convertShoppingListOverlayAction, overlayInitial);

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <FormOverlayDialog open onClose={onClose} title="Comprar lista" titleId="shopping-list-purchase-dialog" wide>
      <p className="mb-4 text-sm text-[var(--muted)]">
        {listFolio} · {supplierId ? "Se usará el proveedor de la lista." : "Indica el proveedor para registrar la compra."}
      </p>
      <form action={formAction}>
        <input type="hidden" name="listId" value={listId} />
        <RequirementPurchaseFormFields
          suppliers={suppliers}
          categories={categories}
          accounts={accounts}
          allowQuickSupplier={allowQuickSupplier}
          refaccion={refaccion}
          supplierRequired={!supplierId}
          fixedSupplierId={supplierId}
          fixedSupplierName={supplierName}
        />
        {state.status === "error" ? (
          <p className="px-5 pt-4 text-sm text-[var(--danger)]" role="alert">{state.message}</p>
        ) : null}
        <FormActions>
          <Button type="button" tone="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Comprar"}</Button>
        </FormActions>
      </form>
    </FormOverlayDialog>
  );
}
