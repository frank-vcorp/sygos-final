"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createShoppingListAction, type CreateShoppingListState } from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { SupplierPicker } from "@/components/supplier-picker";
import { Button, controlClass, Field, FormActions, FormSection } from "@/components/ui";
import type { PickerOption } from "@/components/searchable-entity-picker";

const initialState: CreateShoppingListState = { status: "idle" };

export function ShoppingListCreateModal({
  suppliers,
  allowQuickSupplier,
  initiallyOpen = false,
  showTrigger = true,
  returnHref = "/compras/listas",
}: {
  suppliers: PickerOption[];
  allowQuickSupplier: boolean;
  initiallyOpen?: boolean;
  showTrigger?: boolean;
  returnHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const triggerRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    if (initiallyOpen) router.replace(returnHref);
    requestAnimationFrame(() => triggerRef.current?.querySelector("button")?.focus());
  }

  return (
    <>
      {showTrigger ? (
        <div ref={triggerRef}>
          <Button type="button" onClick={() => setOpen(true)}>Nueva lista</Button>
        </div>
      ) : null}
      {open ? <ShoppingListCreateDialog suppliers={suppliers} allowQuickSupplier={allowQuickSupplier} onClose={close} /> : null}
    </>
  );
}

function ShoppingListCreateDialog({
  suppliers,
  allowQuickSupplier,
  onClose,
}: {
  suppliers: PickerOption[];
  allowQuickSupplier: boolean;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createShoppingListAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.push(`/compras/listas/${state.listId}`);
    router.refresh();
  }, [onClose, router, state]);

  return (
    <FormOverlayDialog open onClose={onClose} title="Nueva lista de compras" titleId="shopping-list-create-dialog" wide>
      <form action={formAction}>
        <FormSection title="Nueva lista" description="Elige si concentrarás refacciones o compras generales.">
          <Field label="Tipo de lista">
            <select name="kind" defaultValue="GENERAL" className={controlClass}>
              <option value="GENERAL">Generales</option>
              <option value="REFACCION">Refacciones</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <SupplierPicker suppliers={suppliers} allowQuickSupplier={allowQuickSupplier} allowEmpty emptyLabel="Sin proveedor por ahora" />
          </div>
        </FormSection>
        {state.status === "error" ? (
          <p className="px-5 pt-4 text-sm text-[var(--danger)]" role="alert">{state.message}</p>
        ) : null}
        <FormActions>
          <Button type="button" tone="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Crear lista"}</Button>
        </FormActions>
      </form>
    </FormOverlayDialog>
  );
}
