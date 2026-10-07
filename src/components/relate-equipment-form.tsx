"use client";

import { useState } from "react";
import { EquipmentQuickFieldsModal } from "@/components/equipment-quick-fields";
import { QuickCreateButton } from "@/components/form-quick-modal";
import { SubmitButton } from "@/components/submit-button";
import { controlClass, Field } from "@/components/ui";

type Gear = { id: string; folio: string; model: string };
type ModelRow = { type: string; brand: string; model: string };

export function RelateEquipmentForm({
  quoteId,
  version,
  gear,
  priorities,
  companyCode,
  allowQuickEquipment,
  types,
  brands,
  models,
  relateAction,
}: {
  quoteId: string;
  version: number;
  gear: Gear[];
  priorities: Array<{ id: string; name: string }>;
  companyCode: string;
  allowQuickEquipment: boolean;
  types: string[];
  brands: string[];
  models: ModelRow[];
  relateAction: (formData: FormData) => void | Promise<void>;
}) {
  const [equipmentId, setEquipmentId] = useState("");
  const [showNew, setShowNew] = useState(false);

  return (
    <form action={relateAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
      <h2 className="font-medium">Relacionar equipo</h2>
      <p className="text-sm text-[var(--muted)]">La operación no arranca hasta que este equipo tenga entrada o ingreso físico.</p>
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="version" value={version} />
      <Field label="Equipo del cliente" hint="Elige un equipo existente o regístralo nuevo.">
        <select
          name="equipmentId"
          className={controlClass}
          value={equipmentId}
          disabled={showNew}
          onChange={(event) => {
            setEquipmentId(event.target.value);
            if (event.target.value) setShowNew(false);
          }}
          required={!allowQuickEquipment}
        >
          <option value="">Selecciona</option>
          {gear.map((item) => <option key={item.id} value={item.id}>{item.folio} · {item.model}</option>)}
        </select>
      </Field>
      {allowQuickEquipment ? (
        <>
          <QuickCreateButton label="+ Alta de equipo" onClick={() => { setEquipmentId(""); setShowNew(true); }} />
          <EquipmentQuickFieldsModal
            open={showNew}
            onClose={() => setShowNew(false)}
            companyCode={companyCode}
            types={types}
            brands={brands}
            models={models}
            doneLabel="Listo — relacionar equipo"
          />
        </>
      ) : null}
      <Field label="Prioridad del servicio">
        <select name="priorityId" required className={controlClass} defaultValue="">
          <option value="">Selecciona</option>
          {priorities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Field>
      <SubmitButton>Relacionar equipo</SubmitButton>
    </form>
  );
}
