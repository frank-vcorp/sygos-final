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
  typeName?: string | null;
  brandName?: string | null;
  serial?: string | null;
};

export function ServiceEquipmentPicker({
  equipment, clientId, companyCode, types, brands, models, warranty = false,
  allowQuickEquipment = true, quickEquipmentKinds, emptyOptionLabel = "Selecciona", required = false, onEquipmentChange,
}: {
  equipment: ServiceEquipmentOption[];
  clientId: string;
  companyCode: string;
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
  warranty?: boolean;
  allowQuickEquipment?: boolean;
  quickEquipmentKinds?: Array<"EQUI" | "MOT">;
  emptyOptionLabel?: string;
  required?: boolean;
  onEquipmentChange?: (equipmentId: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [equipmentId, setEquipmentId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [extraEquipment, setExtraEquipment] = useState<ServiceEquipmentOption[]>([]);
  const [template, setTemplate] = useState<{ sourceId: string; model: string; brand: string; typeName: string; kind?: string } | null>(null);
  const [pickerVersion, setPickerVersion] = useState(0);
  const allowedKinds: Array<"EQUI" | "MOT"> = quickEquipmentKinds ?? (companyCode === "SERVOMOTORES" ? ["MOT"] : ["EQUI", "MOT"]);

  useEffect(() => {
    setEquipmentId("");
    setShowNew(false);
    setTemplate(null);
    onEquipmentChange?.("");
  }, [clientId, onEquipmentChange]);

  function pickEquipment(id: string) {
    setEquipmentId(id);
    onEquipmentChange?.(id);
    if (id) setShowNew(false);
  }

  function openNewEquipment(values: { sourceId: string; model: string; brand: string; typeName: string; kind?: string }) {
    pickEquipment("");
    setTemplate(values);
    setError("");
    setShowNew(true);
    setPickerVersion((current) => current + 1);
  }

  function selectFromCatalog(id: string) {
    if (id.startsWith("catalog-model:")) {
      const row = models[Number(id.slice("catalog-model:".length))];
      if (row) openNewEquipment({ sourceId: id, model: row.model, brand: row.brand, typeName: row.type });
      return;
    }
    const otherClientEquipment = equipment.find((row) => row.id === id && row.clientId !== clientId);
    if (otherClientEquipment) {
      openNewEquipment({
        sourceId: id,
        model: otherClientEquipment.model,
        brand: otherClientEquipment.brandName ?? "",
        typeName: otherClientEquipment.typeName ?? "",
        kind: otherClientEquipment.kind,
      });
      return;
    }
    setTemplate(null);
    pickEquipment(id);
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

  const mustSelect = warranty || required || emptyOptionLabel !== "Sin equipo físico";
  const available = warranty ? equipment : [...equipment, ...extraEquipment];
  const options = warranty
    ? available.map((row) => ({ id: row.id, name: row.folio + " · " + row.model + " (" + row.kind + ")" }))
    : !clientId ? [] : [
      ...available.filter((row) => row.clientId === clientId).map((row) => ({
        id: row.id,
        name: "Equipo del cliente · " + [row.folio, row.model, row.brandName, row.serial].filter(Boolean).join(" · "),
      })),
      ...(allowQuickEquipment && allowedKinds.length > 0 ? available.filter((row) => row.clientId !== clientId).map((row) => ({
        id: row.id,
        name: "Otro cliente · " + [row.folio, row.model, row.brandName, row.serial].filter(Boolean).join(" · ") + " · usar datos",
      })) : []),
      ...(allowQuickEquipment && allowedKinds.length > 0 ? models.map((row, index) => ({
        id: "catalog-model:" + index,
        name: "Modelo del catálogo · " + row.model + " · " + row.brand + " · " + row.type,
      })) : []),
    ];

  return (
    <div className="grid gap-3">
      <SearchableEntityPicker
        key={`${clientId || "sin-cliente"}-${pickerVersion}`}
        label={warranty ? "Equipo con reparación previa" : "Equipo o modelo"}
        name="equipmentId"
        options={options}
        selectedId={equipmentId}
        onSelect={warranty ? pickEquipment : selectFromCatalog}
        required={mustSelect}
        allowEmpty={!mustSelect}
        emptyLabel={warranty ? "Selecciona un equipo con reparación previa" : mustSelect ? "Busca o selecciona un equipo" : "Sin equipo registrado"}
        hint={warranty ? "La garantía exige un equipo con reparación pagada." : !clientId ? "Selecciona primero un cliente." : "Busca en el catálogo por folio, modelo, marca o serie. Una referencia de otro cliente abre el alta con sus datos; no mueve el equipo original."}
        createLabel="Registrar equipo nuevo"
        onCreate={!warranty && allowQuickEquipment && allowedKinds.length > 0 && clientId ? (typedName) => openNewEquipment({ sourceId: "new:" + typedName, model: typedName, brand: "", typeName: "" }) : undefined}
      />
      {showNew ? (
        <div ref={panelRef} className="grid gap-3 rounded-xl border border-[#bed9e9] bg-[#f4f9fc] p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--ink)]">Nuevo equipo</h3>
            <Button type="button" tone="ghost" onClick={() => { setShowNew(false); setTemplate(null); setPickerVersion((current) => current + 1); }}>Cancelar</Button>
          </div>
          {template?.sourceId && !template.sourceId.startsWith("new:") ? (
            <p className="text-xs leading-5 text-[var(--muted)]">Se usarán estos datos como punto de partida. Al guardar se creará un equipo nuevo para el cliente seleccionado; el registro original no cambiará.</p>
          ) : null}
          {allowedKinds.length === 1 ? (
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">Tipo de registro</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{allowedKinds[0] === "MOT" ? "Motor (MOT)" : "Equipo (EQUI)"}</p>
              <input type="hidden" name="equipmentKind" value={allowedKinds[0]} />
            </div>
          ) : (
            <Field label="Tipo de registro">
              <select key={template?.sourceId ?? "new"} name="equipmentKind" className={controlClass} defaultValue={template?.kind && allowedKinds.includes(template.kind as "EQUI" | "MOT") ? template.kind : allowedKinds[0]}>
                {allowedKinds.map((kind) => <option key={kind} value={kind}>{kind === "MOT" ? "Motor (MOT)" : "Equipo (EQUI)"}</option>)}
              </select>
            </Field>
          )}
          <EquipmentCatalogFields key={template?.sourceId ?? "new"} types={types} brands={brands} models={models} initialValues={template ?? undefined} />
          <Field label="Número de serie" hint="Opcional."><input name="serial" className={controlClass} /></Field>
          {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
          <Button type="button" disabled={saving} onClick={() => void saveEquipment()}>{saving ? "Guardando…" : "Guardar equipo y continuar"}</Button>
        </div>
      ) : null}
    </div>
  );
}
