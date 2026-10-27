"use client";

import { useState } from "react";
import { ShoppingListPurchaseDialog } from "./shopping-list-purchase-dialog";
import { Button } from "@/components/ui";
import type { ExpenseCategoryCatalogItem } from "@/lib/expense-catalog";
import type { SupplierWithCurrency } from "../requerimientos/requirement-purchase-form-fields";

export function ShoppingListDetailActions({
  listId,
  listFolio,
  listKind,
  supplierId,
  supplierName,
  lineCount,
  suppliers,
  categories,
  accounts,
  allowQuickSupplier,
}: {
  listId: string;
  listFolio: string;
  listKind: string;
  supplierId: string | null;
  supplierName: string | null;
  lineCount: number;
  suppliers: SupplierWithCurrency[];
  categories: ExpenseCategoryCatalogItem[];
  accounts: Array<{ id: string; name: string }>;
  allowQuickSupplier: boolean;
}) {
  const [open, setOpen] = useState(false);
  const refaccion = listKind === "REFACCION";

  return (
    <>
      <Button type="button" disabled={lineCount === 0} onClick={() => setOpen(true)}>Comprar</Button>
      {open ? (
        <ShoppingListPurchaseDialog
          listId={listId}
          listFolio={listFolio}
          refaccion={refaccion}
          supplierId={supplierId}
          supplierName={supplierName}
          suppliers={suppliers}
          categories={categories}
          accounts={accounts}
          allowQuickSupplier={allowQuickSupplier}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
