"use client";

import { useEffect, useMemo, useState } from "react";
import { EquipmentQuickFieldsModal } from "@/components/equipment-quick-fields";
import { QuickCreateButton } from "@/components/form-quick-modal";
import { controlClass, Field } from "@/components/ui";

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
  emptyOptionLabel = "Selecciona",
}: {
  equipment: ServiceEquipmentOption[];
  clientId: string;
  companyCode: string;
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
  warranty?: boolean;
  emptyOptionLabel?: string;
}) {
  const [equipmentId, setEquipmentId] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    if (!clientId) return [];
    return equipment.filter((row) => row.clientId === clientId);
  }, [equipment, clientId]);

  useEffect(() => {
    setEquipmentId("");
    setShowNew(false);
  }, [clientId]);

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
        companyCode={companyCode}
        types={types}
        brands={brands}
        models={models}
      />
    </>
  );
}
