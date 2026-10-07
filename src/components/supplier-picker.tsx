"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormQuickModal, QuickCreateButton } from "@/components/form-quick-modal";
import { QuickSupplierFields } from "@/components/quick-supplier-fields";
import { controlClass, Field } from "@/components/ui";
import { quickCreateSupplierAction } from "@/lib/quick-create-actions";
import { validateQuickSupplierDraft, type QuickFormFieldMap } from "@/lib/quick-form-persist";

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
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const [showNew, setShowNew] = useState(false);
  const [extraSuppliers, setExtraSuppliers] = useState<SupplierOption[]>([]);
  const options = useMemo(() => {
    const seen = new Set(suppliers.map((row) => row.id));
    return [...suppliers, ...extraSuppliers.filter((row) => !seen.has(row.id))];
  }, [suppliers, extraSuppliers]);

  const selectSupplier = (id: string) => {
    setSupplierId(id);
    if (id) setShowNew(false);
  };

  const commitQuickSupplier = async (fields: QuickFormFieldMap) => {
    const validation = validateQuickSupplierDraft(fields);
    if (validation) return validation;
    const created = await quickCreateSupplierAction(fields);
    setExtraSuppliers((current) => [...current, { id: created.supplierId, name: created.name }]);
    selectSupplier(created.supplierId);
    router.refresh();
    return null;
  };

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
          onChange={(event) => selectSupplier(event.target.value)}
        >
          {allowEmpty ? <option value="">{emptyLabel}</option> : <option value="">Selecciona</option>}
          {options.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
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
            onCommit={commitQuickSupplier}
            doneLabel="Guardar y continuar"
          >
            <QuickSupplierFields required />
          </FormQuickModal>
        </>
      ) : null}
    </>
  );
}
