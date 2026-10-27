"use client";

import { useState } from "react";
import { SupplierPicker } from "@/components/supplier-picker";
import { controlClass, Field } from "@/components/ui";
import { normalizeShoppingListKind, shoppingListKindLabel } from "@/lib/shopping-list-display";
import type { PickerOption } from "@/components/searchable-entity-picker";

type ShoppingListOption = {
  id: string;
  folio: string;
  kind: string;
  supplierId: string | null;
  supplierName: string | null;
};

export function ShoppingListSelection({
  lists,
  suppliers,
  allowQuickSupplier,
  listKind,
}: {
  lists: ShoppingListOption[];
  suppliers: PickerOption[];
  allowQuickSupplier: boolean;
  listKind: "GENERAL" | "REFACCION";
}) {
  const [listId, setListId] = useState("");
  const selectedList = lists.find((list) => list.id === listId);
  const compatibleCount = lists.filter((list) => normalizeShoppingListKind(list.kind) === listKind).length;
  const inheritedSupplier = selectedList?.supplierId ? { id: selectedList.supplierId, name: selectedList.supplierName } : null;

  return (
    <>
      <Field
        label="Lista de compras"
        hint={
          compatibleCount === 0 && lists.length > 0
            ? `No hay listas abiertas de ${shoppingListKindLabel(listKind).toLowerCase()}; puedes crear una nueva.`
            : `El requerimiento es de ${shoppingListKindLabel(listKind).toLowerCase()}; elige una lista del mismo tipo.`
        }
      >
        <select name="shoppingListId" value={listId} onChange={(event) => setListId(event.target.value)} className={controlClass}>
          <option value="">Crear nueva lista</option>
          {lists.map((list) => {
            const kind = normalizeShoppingListKind(list.kind);
            const mismatch = kind !== listKind;
            return (
              <option key={list.id} value={list.id} disabled={mismatch}>
                {list.folio} · {shoppingListKindLabel(kind)}{list.supplierName ? ` — ${list.supplierName}` : ""}{mismatch ? " (otro tipo)" : ""}
              </option>
            );
          })}
        </select>
      </Field>
      {inheritedSupplier ? (
        <div className="md:col-span-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm">
          <input type="hidden" name="supplierId" value={inheritedSupplier.id} />
          <span className="text-[var(--muted)]">Proveedor de la lista</span>
          <strong className="ml-2">{inheritedSupplier.name}</strong>
        </div>
      ) : (
        <div className="md:col-span-2">
          <SupplierPicker
            key={selectedList?.id ?? "new-list"}
            suppliers={suppliers}
            allowQuickSupplier={allowQuickSupplier}
            allowEmpty
            emptyLabel="Sin proveedor por ahora"
          />
        </div>
      )}
    </>
  );
}
