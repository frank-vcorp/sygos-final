"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  const searchParams = useSearchParams();
  const openFromQuery = searchParams.get("nueva") === "1";
  const [open, setOpen] = useState(initiallyOpen || openFromQuery);

  useEffect(() => {
    setOpen(initiallyOpen || openFromQuery);
  }, [initiallyOpen, openFromQuery]);

  function close() {
    setOpen(false);
    if (openFromQuery) router.replace(returnHref);
  }

  return (
    <>
      {showTrigger ? (
        <Button type="button" onClick={() => setOpen(true)}>Nueva O.C.</Button>
      ) : null}
      <FormOverlayDialog open={open} onClose={close} title="Nueva orden de compra" titleId="nueva-oc-title" documentWide>
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
