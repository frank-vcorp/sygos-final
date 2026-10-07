"use client";

import { useState } from "react";
import { QuickPanel } from "@/components/quick-panel";
import { QuickSupplierFields } from "@/components/quick-supplier-fields";
import { controlClass, Field } from "@/components/ui";

type SupplierOption = { id: string; name: string };

export function SupplierPicker({
  suppliers,
  allowQuickSupplier = false,
  defaultSupplierId = "",
  label = "Proveedor",
  hint,
  allowEmpty = false,
  emptyLabel = "Sin proveedor",
  required = false,
}: {
  suppliers: SupplierOption[];
  allowQuickSupplier?: boolean;
  defaultSupplierId?: string;
  label?: string;
  hint?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  required?: boolean;
}) {
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const quickCreateOption = allowQuickSupplier && !allowEmpty;
  const quick = quickCreateOption && !supplierId;

  return (
    <>
      <Field
        label={label}
        hint={
          hint
          ?? (allowQuickSupplier
            ? allowEmpty
              ? "Opcional. Si no está en la lista, usa el alta rápida debajo."
              : "Elige uno existente o registra uno nuevo aquí."
            : undefined)
        }
      >
        <select
          name="supplierId"
          required={required && !allowQuickSupplier}
          className={controlClass}
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
        >
          {allowEmpty ? <option value="">{emptyLabel}</option> : null}
          {quickCreateOption ? <option value="">Crear proveedor en este paso</option> : !allowEmpty ? <option value="">Selecciona</option> : null}
          {suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
      </Field>
      {allowQuickSupplier ? (
        <QuickPanel label="Alta rápida de proveedor" defaultOpen={suppliers.length === 0 || quick}>
          <QuickSupplierFields required={quick} />
        </QuickPanel>
      ) : null}
    </>
  );
}
