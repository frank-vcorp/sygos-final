"use client";

import { ServiceEquipmentPicker, type ServiceEquipmentOption } from "@/components/service-equipment-picker";
import { SubmitButton } from "@/components/submit-button";
import { controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";

type ModelRow = { type: string; brand: string; model: string };

export function RelateEquipmentForm({
  quoteId,
  version,
  clientId,
  gear,
  priorities,
  companyCode,
  allowQuickEquipment,
  quickEquipmentKinds,
  types,
  brands,
  models,
  relateAction,
  frozenPriorityName,
}: {
  quoteId: string;
  version: number;
  clientId: string;
  gear: ServiceEquipmentOption[];
  priorities: Array<{ id: string; name: string }>;
  companyCode: string;
  allowQuickEquipment: boolean;
  quickEquipmentKinds: Array<"EQUI" | "MOT">;
  types: string[];
  brands: string[];
  models: ModelRow[];
  relateAction: (formData: FormData) => void | Promise<void>;
  /** Prioridad ya congelada en COTDX al alta. */
  frozenPriorityName?: string | null;
}) {
  return (
    <FormPanel action={relateAction}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="version" value={version} />
      <FormSection
        title="Relacionar equipo"
        description="La operación no arranca hasta que este equipo tenga entrada o ingreso físico."
        columns={1}
      >
        <ServiceEquipmentPicker
          equipment={gear}
          clientId={clientId}
          companyCode={companyCode}
          types={types}
          brands={brands}
          models={models}
          allowQuickEquipment={allowQuickEquipment}
          quickEquipmentKinds={quickEquipmentKinds}
          pickExistingFolio
          emptyOptionLabel="Selecciona"
        />
        <Field label="Prioridad del servicio">
          {frozenPriorityName ? (
            <>
              <input type="hidden" name="priorityId" value="" />
              <p className="rounded-md border border-[var(--line)] bg-[#f7fafc] px-3 py-2 text-sm">{frozenPriorityName} (definida en la cotización)</p>
            </>
          ) : (
            <select name="priorityId" required className={controlClass} defaultValue="">
              <option value="">Selecciona</option>
              {priorities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          )}
        </Field>
      </FormSection>
      <FormActions><SubmitButton>Relacionar equipo</SubmitButton></FormActions>
    </FormPanel>
  );
}
