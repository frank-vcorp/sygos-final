"use client";

import { useEffect, useRef, useState } from "react";
import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { SearchableEntityPicker } from "@/components/searchable-entity-picker";
import { Button, controlClass, Field } from "@/components/ui";
import { quickCreateEquipmentAction } from "@/lib/quick-create-actions";
import { readNamedFormFields, validateQuickEquipmentDraft, type QuickFormFieldMap } from "@/lib/quick-form-persist";

export type ServiceEquipmentOption = {
  id: string;
  folio: string;
  model: string;
  clientId: string;
  kind: string;
};

export function ServiceEquipmentPicker({
  equipment, clientId, companyCode, types, brands, models, warranty = false,
  allowQuickEquipment = true, emptyOptionLabel = "Selecciona", onEquipmentChange,
}: {
  equipment: ServiceEquipmentOption[];
  clientId: string;
  companyCode: string;
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
  warranty?: boolean;
  allowQuickEquipment?: boolean;
  emptyOptionLabel?: string;
  onEquipmentChange?: (equipmentId: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [equipmentId, setEquipmentId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [extraEquipment, setExtraEquipment] = useState<ServiceEquipmentOption[]>([]);

  useEffect(() => {
    setEquipmentId("");
    setShowNew(false);
    setExtraEquipment([]);
    onEquipmentChange?.("");
  }, [clientId, onEquipmentChange]);

  function pickEquipment(id: string) {
    setEquipmentId(id);
    onEquipmentChange?.(id);
    if (id) setShowNew(false);
  }

  async function saveEquipment() {
    if (saving || !panelRef.current) return;
    for (const input of panelRef.current.querySelectorAll<HTMLInputElement>("input")) {
      if (!input.reportValidity()) return;
    }
    const fields: QuickFormFieldMap = readNamedFormFields(panelRef.current);
    const validation = validateQuickEquipmentDraft(fields);
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError("");
    try {
      const created = await quickCreateEquipmentAction(clientId, fields);
      const row: ServiceEquipmentOption = {
        id: created.equipmentId, folio: created.folio, model: created.model,
        clientId: created.clientId, kind: created.kind,
      };
      setExtraEquipment((current) => [...current, row]);
      pickEquipment(created.equipmentId);
      setShowNew(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el equipo.");
    } finally {
      setSaving(false);
    }
  }

  const available = warranty ? equipment : [...equipment, ...extraEquipment].filter((row) => row.clientId === clientId);
  const options = available.map((row) => ({ id: row.id, name: row.folio + " · " + row.model + " (" + row.kind + ")" }));

  return (
    <div className="grid gap-3">
      <SearchableEntityPicker
        label="Equipo del cliente"
        name="equipmentId"
        options={options}
        selectedId={equipmentId}
        onSelect={pickEquipment}
        required={warranty || emptyOptionLabel !== "Sin equipo físico"}
        allowEmpty={!warranty && emptyOptionLabel === "Sin equipo físico"}
        emptyLabel={warranty ? "Selecciona un equipo con reparación previa" : emptyOptionLabel === "Sin equipo físico" ? "Sin equipo registrado" : "Busca o selecciona un equipo"}
        hint={warranty ? "La garantía exige un equipo con reparación pagada." : !clientId ? "Selecciona primero un cliente." : "Busca por folio o modelo dentro de la lista."}
        createLabel="Nuevo equipo"
        onCreate={!warranty && allowQuickEquipment && clientId ? () => { pickEquipment(""); setError(""); setShowNew(true); } : undefined}
      />
      {showNew ? (
        <div ref={panelRef} className="grid gap-3 rounded-xl border border-[#bed9e9] bg-[#f4f9fc] p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--ink)]">Nuevo equipo</h3>
            <Button type="button" tone="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
          </div>
          <Field label="EQUI o MOT">
            <select name="equipmentKind" className={controlClass} defaultValue={companyCode === "SERVOMOTORES" ? "MOT" : "EQUI"}>
              {companyCode === "SYSTRON" ? <option value="EQUI">EQUI</option> : null}
              <option value="MOT">MOT</option>
            </select>
          </Field>
          <EquipmentCatalogFields types={types} brands={brands} models={models} />
          <Field label="Número de serie" hint="Opcional."><input name="serial" className={controlClass} /></Field>
          {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
          <Button type="button" disabled={saving} onClick={() => void saveEquipment()}>{saving ? "Guardando…" : "Guardar equipo y continuar"}</Button>
        </div>
      ) : null}
    </div>
  );
}
