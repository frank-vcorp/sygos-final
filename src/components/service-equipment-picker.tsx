"use client";

import { useEffect, useMemo, useState } from "react";
import { EquipmentQuickFieldsModal } from "@/components/equipment-quick-fields";
import { QuickCreateButton } from "@/components/form-quick-modal";
import { controlClass, Field } from "@/components/ui";
import { quickCreateEquipmentAction } from "@/lib/quick-create-actions";
import { validateQuickEquipmentDraft, type QuickFormFieldMap } from "@/lib/quick-form-persist";

export type ServiceEquipmentOption = {
  id: string;
  folio: string;
  model: string;
  clientId: string;
  kind: string;
};

export function ServiceEquipmentPicker({
  equipment,
  clientId,
  companyCode,
  types,
  brands,
  models,
  warranty = false,
  allowQuickEquipment = true,
  emptyOptionLabel = "Selecciona",
  onEquipmentChange,
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
  const [equipmentId, setEquipmentId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [extraEquipment, setExtraEquipment] = useState<ServiceEquipmentOption[]>([]);

  const allEquipment = useMemo(
    () => [...equipment, ...extraEquipment],
    [equipment, extraEquipment],
  );

  const filtered = useMemo(() => {
    if (!clientId) return [];
    return allEquipment.filter((row) => row.clientId === clientId);
  }, [allEquipment, clientId]);

  useEffect(() => {
    setEquipmentId("");
    setShowNew(false);
    setExtraEquipment([]);
    onEquipmentChange?.("");
  }, [clientId, onEquipmentChange]);

  const pickEquipment = (id: string) => {
    setEquipmentId(id);
    onEquipmentChange?.(id);
    if (id) setShowNew(false);
  };

  const commitQuickEquipment = async (fields: QuickFormFieldMap) => {
    const validation = validateQuickEquipmentDraft(fields);
    if (validation) return validation;
    const created = await quickCreateEquipmentAction(clientId, fields);
    const row: ServiceEquipmentOption = {
      id: created.equipmentId,
      folio: created.folio,
      model: created.model,
      clientId: created.clientId,
      kind: created.kind,
    };
    setExtraEquipment((current) => [...current, row]);
    pickEquipment(created.equipmentId);
    return null;
  };

  if (warranty) {
    return (
      <Field label="Equipo" hint="La garantía exige un equipo que ya tuvo una reparación pagada.">
        <select
          name="equipmentId"
          required
          className={controlClass}
          value={equipmentId}
          onChange={(event) => setEquipmentId(event.target.value)}
        >
          <option value="">Selecciona</option>
          {equipment.map((item) => (
            <option key={item.id} value={item.id}>{item.folio} · {item.model}</option>
          ))}
        </select>
      </Field>
    );
  }

  return (
    <>
      <div className={allowQuickEquipment ? "flex flex-col gap-3 sm:flex-row sm:items-end" : undefined}>
        <Field
          label="Equipo del cliente"
          hint={
            !clientId
              ? "Selecciona un cliente para ver sus equipos."
              : filtered.length === 0
                ? "Sin equipos en cartera. Registra uno con el botón al lado."
                : "Equipo existente o alta nueva."
          }
          className={allowQuickEquipment ? "min-w-0 flex-1" : undefined}
        >
          <select
            name="equipmentId"
            className={controlClass}
            value={equipmentId}
            required={emptyOptionLabel !== "Sin equipo físico"}
            disabled={!clientId || showNew}
            onChange={(event) => pickEquipment(event.target.value)}
          >
            <option value="">{emptyOptionLabel}</option>
            {filtered.map((item) => (
              <option key={item.id} value={item.id}>
                {item.folio} · {item.model} ({item.kind})
              </option>
            ))}
          </select>
        </Field>

        {allowQuickEquipment ? (
          <QuickCreateButton
            label="+ Alta de equipo"
            disabled={!clientId}
            disabledHint="Primero elige el cliente."
            onClick={() => {
              pickEquipment("");
              setShowNew(true);
            }}
          />
        ) : null}
      </div>

      {allowQuickEquipment ? (
        <>
          <EquipmentQuickFieldsModal
            open={showNew}
            onClose={() => setShowNew(false)}
            onCommit={commitQuickEquipment}
            companyCode={companyCode}
            types={types}
            brands={brands}
            models={models}
          />
        </>
      ) : null}
    </>
  );
}
