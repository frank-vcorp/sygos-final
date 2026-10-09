"use client";

import { useState } from "react";
import { ClientPicker } from "@/components/client-picker";
import { ServiceEquipmentPicker, type ServiceEquipmentOption } from "@/components/service-equipment-picker";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";

type PriorityOption = { id: string; name: string };
type RepairOption = { id: string; folio: string };

export function ServiceStartForm({
  action,
  attentionType,
  clients,
  equipment,
  priorities,
  types,
  brands,
  models,
  repairs,
  defaultClientId,
  companyCode,
  allowQuickClient,
  allowQuickEquipment = true,
  warranty,
}: {
  action: (formData: FormData) => void | Promise<void>;
  attentionType: string;
  clients: Array<{ id: string; name: string }>;
  equipment: ServiceEquipmentOption[];
  priorities: PriorityOption[];
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
  repairs: RepairOption[];
  defaultClientId: string;
  companyCode: string;
  allowQuickClient: boolean;
  allowQuickEquipment?: boolean;
  warranty: boolean;
}) {
  const [clientId, setClientId] = useState(defaultClientId);

  return (
    <FormPanel action={action} className="max-w-3xl">
      <input type="hidden" name="attentionType" value={attentionType} />
      <FormSection
        title={warranty ? "Equipo" : "Cliente y equipo"}
        description={warranty ? "El cliente se infiere de la reparación de origen." : "Busca en catálogo o crea un registro mínimo sin salir del flujo."}
        columns={1}
      >
        {warranty ? null : (
          <ClientPicker
            label="Cliente"
            clients={clients}
            defaultClientId={defaultClientId}
            allowQuickClient={allowQuickClient}
            extendedContact={false}
            onClientChange={setClientId}
          />
        )}
        <ServiceEquipmentPicker
          equipment={equipment}
          clientId={clientId}
          companyCode={companyCode}
          types={types}
          brands={brands}
          models={models}
          warranty={warranty}
          allowQuickEquipment={allowQuickEquipment}
        />
      </FormSection>
      <FormSection title="Servicio" description="La prioridad define el SLA cuando el equipo tenga entrada física.">
        <Field label="Prioridad">
          <select name="priorityId" required className={controlClass}>
            <option value="">Selecciona</option>
            {priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}
          </select>
        </Field>
        <Field label="Falla reportada"><textarea name="reportedFault" required rows={3} className={controlClass} /></Field>
        {warranty ? (
          <>
            <Field label="Reparación pagada de origen">
              <select name="originalCaseId" required className={controlClass}>
                <option value="">Selecciona</option>
                {repairs.map((repair) => <option key={repair.id} value={repair.id}>{repair.folio}</option>)}
              </select>
            </Field>
            <Field label="Antecedente"><input name="antecedent" required className={controlClass} /></Field>
          </>
        ) : null}
      </FormSection>
      <FormSection title="Información adicional" columns={1}>
        <Field label="Instrucciones de entrega" hint="Opcional. Quién recibe o cómo entregar el equipo.">
          <textarea name="deliveryInstructions" rows={2} className={controlClass} />
        </Field>
      </FormSection>
      <FormActions note="El SLA inicia con la entrada física en taller, no con este alta.">
        <Button type="submit">Crear atención</Button>
      </FormActions>
    </FormPanel>
  );
}
