"use client";

import { useState } from "react";
import { createPartAction } from "@/app/(erp)/inventario/actions";
import { InventoryPartCreateFields } from "@/components/inventory-part-create-fields";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button } from "@/components/ui";

export type InventoryCreateCatalog = {
  families: Array<{ family: string; count: number }>;
  racks: Array<{ rack: string; count: number }>;
  niveles: Array<{ value: string; count: number }>;
  units: Array<{ value: string; count: number }>;
  mountTypes: Array<{ value: string; count: number }>;
  catalogNumeros: Array<{ value: string; count: number }>;
};

export function InventoryCreateLineOverlay({ catalog }: { catalog: InventoryCreateCatalog }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" tone="ghost" className="text-sm font-medium" onClick={() => setOpen(true)}>
        Subir inventario
      </Button>
      <FormOverlayDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Subir inventario"
        titleId="inventory-create-line-dialog"
        wide
      >
        <p className="mb-4 text-sm text-[var(--muted)]">
          Usa los listados del inventario importado; «Otro» solo si el valor no existe en catálogo. La existencia inicial queda en cero hasta un movimiento de entrada.
        </p>
        <form action={createPartAction} className="grid gap-4">
          <InventoryPartCreateFields catalog={catalog} />
          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <Button type="button" tone="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Agregar al catálogo</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
