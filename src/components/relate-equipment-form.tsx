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
  types,
  brands,
  models,
  relateAction,
}: {
  quoteId: string;
  version: number;
  clientId: string;
  gear: ServiceEquipmentOption[];
  priorities: Array<{ id: string; name: string }>;
  companyCode: string;
  allowQuickEquipment: boolean;
  types: string[];
  brands: string[];
  models: ModelRow[];
  relateAction: (formData: FormData) => void | Promise<void>;
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
          emptyOptionLabel="Selecciona"
        />
        <Field label="Prioridad del servicio">
          <select name="priorityId" required className={controlClass} defaultValue="">
            <option value="">Selecciona</option>
            {priorities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
      </FormSection>
      <FormActions><SubmitButton>Relacionar equipo</SubmitButton></FormActions>
    </FormPanel>
  );
}
