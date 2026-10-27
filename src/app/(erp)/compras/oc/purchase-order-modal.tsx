"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PurchaseOrderForm } from "./purchase-order-form";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button } from "@/components/ui";
import type { ExpenseCategoryCatalogItem } from "@/lib/expense-catalog";
import type { PickerOption } from "@/components/searchable-entity-picker";

export function PurchaseOrderModal({
  suppliers,
  categories,
  accounts,
  allowQuickSupplier,
  initiallyOpen = false,
  showTrigger = true,
  returnHref = "/compras?vista=oc",
}: {
  suppliers: PickerOption[];
  categories: ExpenseCategoryCatalogItem[];
  accounts: Array<{ id: string; name: string }>;
  allowQuickSupplier: boolean;
  initiallyOpen?: boolean;
  showTrigger?: boolean;
  returnHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);

  function close() {
    setOpen(false);
    if (initiallyOpen) router.replace(returnHref);
  }

  return (
    <>
      {showTrigger ? (
        <Button type="button" onClick={() => setOpen(true)}>Nueva O.C.</Button>
      ) : null}
      <FormOverlayDialog open={open} onClose={close} title="Nueva orden de compra" titleId="nueva-oc-title" wide>
        <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
          Captura proveedor, partidas con precio y datos para finanzas. Se enviará a autorización.
        </p>
        <PurchaseOrderForm
          suppliers={suppliers}
          categories={categories}
          accounts={accounts}
          allowQuickSupplier={allowQuickSupplier}
        />
      </FormOverlayDialog>
    </>
  );
}
