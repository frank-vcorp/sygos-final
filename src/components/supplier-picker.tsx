"use client";

import { useState } from "react";
import { FormQuickModal, QuickCreateButton } from "@/components/form-quick-modal";
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
  const [showNew, setShowNew] = useState(false);
  const quick = allowQuickSupplier && !supplierId && !allowEmpty;

  return (
    <>
      <Field
        label={label}
        hint={
          hint
          ?? (allowQuickSupplier
            ? allowEmpty
              ? "Opcional. Elige uno existente o regístralo nuevo."
              : "Elige un proveedor de la lista o usa el alta si aún no existe."
            : undefined)
        }
      >
        <select
          name="supplierId"
          required={required && !allowQuickSupplier}
          className={controlClass}
          value={supplierId}
          disabled={showNew}
          onChange={(event) => {
            const next = event.target.value;
            setSupplierId(next);
            if (next) setShowNew(false);
          }}
        >
          {allowEmpty ? <option value="">{emptyLabel}</option> : <option value="">Selecciona</option>}
          {suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
      </Field>
      {allowQuickSupplier && !supplierId ? (
        <>
          <QuickCreateButton label="+ Alta de proveedor" onClick={() => setShowNew(true)} />
          <FormQuickModal
            open={showNew}
            title="Alta de proveedor"
            titleId="supplier-quick-modal-title"
            onClose={() => setShowNew(false)}
            doneLabel="Listo — continuar"
          >
            <QuickSupplierFields required={quick} />
          </FormQuickModal>
        </>
      ) : null}
    </>
  );
}
