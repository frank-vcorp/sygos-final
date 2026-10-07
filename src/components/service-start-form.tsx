"use client";

import { useState } from "react";
import { ClientPicker } from "@/components/client-picker";
import { ServiceEquipmentPicker, type ServiceEquipmentOption } from "@/components/service-equipment-picker";
import { Button, controlClass, Field } from "@/components/ui";

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
    <form action={action} className="grid max-w-2xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
      <input type="hidden" name="attentionType" value={attentionType} />
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
      <Field label="Instrucciones de entrega"><textarea name="deliveryInstructions" rows={2} className={controlClass} /></Field>
      <Button type="submit">Abrir servicio</Button>
    </form>
  );
}
