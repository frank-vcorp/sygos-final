"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { QuickSupplierFields } from "@/components/quick-supplier-fields";
import { SearchableEntityPicker, type PickerOption } from "@/components/searchable-entity-picker";
import { Button } from "@/components/ui";
import { quickCreateSupplierAction } from "@/lib/quick-create-actions";
import { readNamedFormFields, validateQuickSupplierDraft, type QuickFormFieldMap } from "@/lib/quick-form-persist";

export function SupplierPicker({
  suppliers, allowQuickSupplier = false, defaultSupplierId = "", label = "Proveedor",
  hint, allowEmpty = false, emptyLabel = "Sin proveedor", required = false, onSupplierChange,
}: {
  suppliers: PickerOption[];
  allowQuickSupplier?: boolean;
  defaultSupplierId?: string;
  label?: string;
  hint?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  required?: boolean;
  onSupplierChange?: (supplierId: string) => void;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const [showNew, setShowNew] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [extraSuppliers, setExtraSuppliers] = useState<PickerOption[]>([]);
  const seen = new Set(suppliers.map((row) => row.id));
  const options = [...suppliers, ...extraSuppliers.filter((row) => !seen.has(row.id))];

  async function saveSupplier() {
    if (saving || !panelRef.current) return;
    for (const input of panelRef.current.querySelectorAll<HTMLInputElement>("input")) {
      if (!input.reportValidity()) return;
    }
    const fields: QuickFormFieldMap = readNamedFormFields(panelRef.current);
    const validation = validateQuickSupplierDraft(fields);
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError("");
    try {
      const created = await quickCreateSupplierAction(fields);
      setExtraSuppliers((current) => [...current, { id: created.supplierId, name: created.name }]);
      setSupplierId(created.supplierId);
      onSupplierChange?.(created.supplierId);
      setShowNew(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el proveedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <SearchableEntityPicker
        label={label}
        name="supplierId"
        options={options}
        selectedId={supplierId}
        onSelect={(id) => { setSupplierId(id); onSupplierChange?.(id); if (id) setShowNew(false); }}
        required={required}
        allowEmpty={allowEmpty}
        emptyLabel={allowEmpty ? emptyLabel : "Busca o selecciona un proveedor"}
        hint={hint ?? (allowQuickSupplier ? "Busca en el mismo campo o agrega un proveedor nuevo." : undefined)}
        createLabel="Nuevo proveedor"
        onCreate={allowQuickSupplier ? (typed) => {
          setSupplierId("");
          setDraftName(typed);
          setError("");
          setShowNew(true);
        } : undefined}
      />
      {showNew ? (
        <div ref={panelRef} data-quick-create-open="" className="grid gap-3 rounded-xl border border-[#bed9e9] bg-[#f4f9fc] p-4"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
              event.preventDefault();
              void saveSupplier();
            }
          }}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--ink)]">Nuevo proveedor</h3>
            <Button type="button" tone="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
          </div>
          <QuickSupplierFields required defaultName={draftName} />
          {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
          <Button type="button" className="sticky bottom-3 z-40 shadow-[0_8px_22px_rgba(20,45,75,0.18)]" disabled={saving} onClick={() => void saveSupplier()}>{saving ? "Guardando…" : "Guardar proveedor y continuar"}</Button>
        </div>
      ) : null}
    </div>
  );
}
