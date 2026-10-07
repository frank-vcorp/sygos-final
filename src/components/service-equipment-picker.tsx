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
  }, [clientId]);

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
    setEquipmentId(created.equipmentId);
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
      <Field
        label="Equipo del cliente"
        hint={
          !clientId
            ? "Selecciona un cliente para ver sus equipos."
            : filtered.length === 0
              ? "Este cliente no tiene equipos registrados. Usa el alta de equipo."
              : "Elige un equipo existente o regístralo nuevo."
        }
      >
        <select
          name="equipmentId"
          className={controlClass}
          value={equipmentId}
          required={emptyOptionLabel !== "Sin equipo físico"}
          disabled={!clientId || showNew}
          onChange={(event) => {
            setEquipmentId(event.target.value);
            if (event.target.value) setShowNew(false);
          }}
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
        <>
          <QuickCreateButton
            label="+ Alta de equipo"
            disabled={!clientId}
            disabledHint="Primero elige el cliente."
            onClick={() => {
              setEquipmentId("");
              setShowNew(true);
            }}
          />
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
