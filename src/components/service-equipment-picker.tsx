"use client";

import { useEffect, useRef, useState } from "react";
import { EquipmentCatalogFields } from "@/components/equipment-catalog-fields";
import { SearchableEntityPicker } from "@/components/searchable-entity-picker";
import { Button, controlClass, Field } from "@/components/ui";
import type { EquipmentCatalogByKind } from "@/lib/catalog";
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
  equipment, clientId, companyCode, types, brands, models, catalogByKind, warranty = false,
  allowQuickEquipment = true, quickEquipmentKinds, emptyOptionLabel = "Selecciona", required = false,
  pickExistingFolio = false,
  onEquipmentChange,
  onEquipmentKindChange,
}: {
  equipment: ServiceEquipmentOption[];
  clientId: string;
  companyCode: string;
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
  catalogByKind?: EquipmentCatalogByKind;
  warranty?: boolean;
  allowQuickEquipment?: boolean;
  quickEquipmentKinds?: Array<"EQUI" | "MOT">;
  emptyOptionLabel?: string;
  required?: boolean;
  /** Si false, el buscador solo sugiere tipo/marca/modelo (catálogo); siempre alta de folio nuevo. */
  pickExistingFolio?: boolean;
  onEquipmentChange?: (equipmentId: string) => void;
  onEquipmentKindChange?: (kind: "EQUI" | "MOT") => void;
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
  const [draftKind, setDraftKind] = useState<"EQUI" | "MOT">(allowedKinds[0] ?? "EQUI");
  const activeCatalog = catalogByKind?.[draftKind] ?? { types, brands, models };
  const suggestionModels = catalogByKind
    ? allowedKinds.flatMap((kind) => catalogByKind[kind].models.map((row) => ({ ...row, kind })))
    : models.map((row) => ({ ...row, kind: allowedKinds[0] ?? "EQUI" as const }));

  useEffect(() => {
    setEquipmentId("");
    setShowNew(false);
    setTemplate(null);
    onEquipmentChange?.("");
  }, [clientId, onEquipmentChange]);

  function pickEquipment(id: string) {
    setEquipmentId(id);
    onEquipmentChange?.(id);
    if (id) {
      const row = [...equipment, ...extraEquipment].find((item) => item.id === id);
      if (row?.kind === "MOT" || row?.kind === "EQUI") onEquipmentKindChange?.(row.kind);
      setShowNew(false);
    } else {
      onEquipmentKindChange?.(allowedKinds[0] ?? "EQUI");
    }
  }

  function openNewEquipment(values: { sourceId: string; model: string; brand: string; typeName: string; kind?: string }) {
    const nextKind = values.kind === "MOT" || values.kind === "EQUI"
      ? (allowedKinds.includes(values.kind) ? values.kind : allowedKinds[0] ?? "EQUI")
      : allowedKinds[0] ?? "EQUI";
    pickEquipment("");
    setDraftKind(nextKind);
    onEquipmentKindChange?.(nextKind);
    setTemplate({ ...values, kind: nextKind });
    setError("");
    setShowNew(true);
    setPickerVersion((current) => current + 1);
  }

  function selectFromCatalog(id: string) {
    if (id.startsWith("catalog-model:")) {
      const row = suggestionModels[Number(id.slice("catalog-model:".length))];
      if (row) openNewEquipment({ sourceId: id, model: row.model, brand: row.brand, typeName: row.type, kind: row.kind });
      return;
    }
    if (pickExistingFolio) {
      const row = [...equipment, ...extraEquipment].find((item) => item.id === id);
      if (!row || row.clientId !== clientId) {
        setError("Ese folio pertenece a otro cliente. Elige un equipo de este cliente o registra uno nuevo.");
        return;
      }
      setTemplate(null);
      pickEquipment(id);
      return;
    }
    setError("Elige un modelo del catálogo o registra una identificación nueva.");
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
      onEquipmentKindChange?.(created.kind === "MOT" ? "MOT" : "EQUI");
      setShowNew(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el equipo.");
    } finally {
      setSaving(false);
    }
  }

  const mustSelect = warranty || required || emptyOptionLabel !== "Sin equipo físico";
  const available = warranty ? equipment : [...equipment, ...extraEquipment];
  const templateOnly = !warranty && !pickExistingFolio;

  function equipmentOptionName(row: ServiceEquipmentOption) {
    return [row.folio, row.model, row.brandName, row.serial].filter(Boolean).join(" · ");
  }

  function equipmentOption(row: ServiceEquipmentOption) {
    return { id: row.id, name: equipmentOptionName(row) };
  }

  const options = warranty
    ? available.map((row) => ({ id: row.id, name: row.folio + " · " + row.model + " (" + row.kind + ")" }))
    : !clientId ? [] : templateOnly
      ? (() => {
        const byId = new Map<string, { id: string; name: string }>();
        for (const row of extraEquipment.filter((item) => item.clientId === clientId)) {
          byId.set(row.id, equipmentOption(row));
        }
        for (const row of available.filter((item) => item.clientId === clientId)) {
          byId.set(row.id, equipmentOption(row));
        }
        const saved = [...byId.values()];
        const catalogOptions =
          allowQuickEquipment && allowedKinds.length > 0
            ? suggestionModels.map((row, index) => ({
                id: "catalog-model:" + index,
                name: [row.model, row.brand, row.type].filter(Boolean).join(" · "),
              }))
            : [];
        const merged = [...saved, ...catalogOptions];
        if (equipmentId && !merged.some((row) => row.id === equipmentId)) {
          const selected = available.find((row) => row.id === equipmentId);
          if (selected) merged.unshift(equipmentOption(selected));
        }
        return merged;
      })()
      : (() => {
        const byId = new Map<string, { id: string; name: string }>();
        for (const row of extraEquipment.filter((item) => item.clientId === clientId)) {
          byId.set(row.id, equipmentOption(row));
        }
        for (const row of available.filter((item) => item.clientId === clientId)) {
          byId.set(row.id, equipmentOption(row));
        }
        const clientOptions = [...byId.values()];
        const catalogOptions =
          allowQuickEquipment && allowedKinds.length > 0
            ? suggestionModels.map((row, index) => ({
                id: "catalog-model:" + index,
                name: [row.model, row.brand, row.type].filter(Boolean).join(" · "),
              }))
            : [];
        const merged = [...clientOptions, ...catalogOptions];
        if (equipmentId && !merged.some((row) => row.id === equipmentId)) {
          const selected = available.find((row) => row.id === equipmentId);
          if (selected) merged.unshift(equipmentOption(selected));
        }
        return merged;
      })();

  const pickerLabel = warranty
    ? "Equipo con reparación previa"
    : templateOnly
      ? "Modelo (sugerencia para etiqueta)"
      : "Equipo o modelo";
  const pickerHint = warranty
    ? "La garantía exige un equipo con reparación pagada."
    : !clientId
      ? "Selecciona primero un cliente."
      : templateOnly
        ? "El catálogo solo prellena tipo, marca y modelo. Siempre se crea un folio nuevo; no reutiliza equipos existentes."
        : "Busca por folio, modelo, marca o serie.";
  const pickerEmpty = warranty
    ? "Selecciona un equipo con reparación previa"
    : mustSelect
      ? templateOnly
        ? "Elige un modelo del catálogo"
        : "Busca o selecciona un equipo"
      : "Sin equipo registrado";

  const savedFolio = equipmentId
    ? [...equipment, ...extraEquipment].find((row) => row.id === equipmentId)
    : null;

  return (
    <div className="grid gap-3">
      {error && !showNew ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
      {savedFolio && templateOnly ? (
        <p className="rounded-md border border-[var(--line)] bg-[#f7fafc] px-3 py-2 text-sm">
          Folio creado: <span className="font-medium">{savedFolio.folio}</span>
          {" · "}
          {[savedFolio.brandName, savedFolio.model, savedFolio.serial].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <SearchableEntityPicker
        key={`${clientId || "sin-cliente"}-${pickerVersion}`}
        label={pickerLabel}
        name="equipmentId"
        options={options}
        selectedId={equipmentId}
        onSelect={warranty ? pickEquipment : selectFromCatalog}
        required={mustSelect}
        allowEmpty={!mustSelect}
        emptyLabel={pickerEmpty}
        hint={pickerHint}
        createLabel={templateOnly ? "Registrar identificación nueva" : "Registrar equipo nuevo"}
        onCreate={!warranty && allowQuickEquipment && allowedKinds.length > 0 && clientId ? (typedName) => openNewEquipment({ sourceId: "new:" + typedName, model: typedName, brand: "", typeName: "" }) : undefined}
      />
      {showNew ? (
        <div ref={panelRef} data-quick-create-open="" className="grid gap-3 rounded-xl border border-[#bed9e9] bg-[#f4f9fc] p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--ink)]">Nuevo equipo</h3>
            <Button type="button" tone="ghost" onClick={() => { setShowNew(false); setTemplate(null); setPickerVersion((current) => current + 1); }}>Cancelar</Button>
          </div>
          {template?.sourceId ? (
            <p className="text-xs leading-5 text-[var(--muted)]">
              {template.sourceId.startsWith("catalog-model:")
                ? "Datos del catálogo solo orientan la etiqueta. Al guardar se crea un folio nuevo para este cliente."
                : "Al guardar se crea un folio nuevo para el cliente seleccionado."}
            </p>
          ) : null}
          {allowedKinds.length === 1 ? (
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">Tipo de registro</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{allowedKinds[0] === "MOT" ? "Motor (MOT)" : "Equipo (EQUI)"}</p>
              <input type="hidden" name="equipmentKind" value={allowedKinds[0]} />
            </div>
          ) : (
            <Field label="Tipo de registro">
              <select
                key={template?.sourceId ?? "new"}
                name="equipmentKind"
                className={controlClass}
                value={draftKind}
                onChange={(event) => {
                  const next = event.target.value === "MOT" ? "MOT" : "EQUI";
                  setDraftKind(next);
                  onEquipmentKindChange?.(next);
                }}
              >
                {allowedKinds.map((kind) => <option key={kind} value={kind}>{kind === "MOT" ? "Motor (MOT)" : "Equipo (EQUI)"}</option>)}
              </select>
            </Field>
          )}
          <EquipmentCatalogFields
            key={`${template?.sourceId ?? "new"}-${draftKind}`}
            types={activeCatalog.types}
            brands={activeCatalog.brands}
            models={activeCatalog.models}
            typeLabel={draftKind === "MOT" ? "Tipo de motor" : "Tipo de equipo"}
            initialValues={template?.kind === draftKind ? template : undefined}
          />
          <Field label="Número de serie" hint="Opcional."><input name="serial" className={controlClass} /></Field>
          {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
          <Button type="button" className="sticky bottom-3 z-40 shadow-[0_8px_22px_rgba(20,45,75,0.18)]" disabled={saving} onClick={() => void saveEquipment()}>{saving ? "Guardando…" : "Guardar equipo y continuar"}</Button>
        </div>
      ) : null}
    </div>
  );
}
