"use client";

import { useState } from "react";
import { ClientPicker } from "@/components/client-picker";
import { ServiceEquipmentPicker, type ServiceEquipmentOption } from "@/components/service-equipment-picker";
import { Button, controlClass, Field, FormActions, FormBlock, FormPanel } from "@/components/ui";

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
  quickEquipmentKinds,
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
  quickEquipmentKinds?: Array<"EQUI" | "MOT">;
  warranty: boolean;
}) {
  const [clientId, setClientId] = useState(defaultClientId);

  return (
    <FormPanel action={action} className="mx-auto max-w-6xl">
      <input type="hidden" name="attentionType" value={attentionType} />
      <div className="grid gap-5 p-5 md:p-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(330px,0.85fr)]">
        <FormBlock
          title={warranty ? "1. Equipo" : "1. Cliente y equipo"}
          description={warranty ? "El cliente se infiere de la reparación de origen." : "Busca en catálogo o crea un registro mínimo sin salir del flujo."}
          columns={1}
          tone="muted"
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
            quickEquipmentKinds={quickEquipmentKinds}
          />
        </FormBlock>

        <FormBlock
          title="2. Datos del servicio"
          description="Define la prioridad y describe el motivo del ingreso."
          columns={1}
        >
          <Field label="Prioridad">
            <select name="priorityId" required className={controlClass}>
              <option value="">Selecciona</option>
              {priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.name}</option>)}
            </select>
          </Field>
          <Field label="Falla reportada" hint="Describe el síntoma o problema que reporta el cliente.">
            <textarea name="reportedFault" required rows={4} className={controlClass} />
          </Field>
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
        </FormBlock>

        <details className="group rounded-2xl border border-[var(--line)] bg-[#f8fbfd] xl:col-span-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-[var(--ink)] [&::-webkit-details-marker]:hidden">
            <span>Información adicional <span className="ml-1 text-xs font-normal text-[var(--muted)]">Opcional</span></span>
            <span className="text-lg text-[var(--muted)] transition-transform group-open:rotate-90" aria-hidden>›</span>
          </summary>
          <div className="border-t border-[var(--line)] p-4 md:p-5">
            <Field label="Instrucciones de entrega" hint="Quién recibe o cómo entregar el equipo.">
              <textarea name="deliveryInstructions" rows={2} className={controlClass} />
            </Field>
          </div>
        </details>
      </div>
      <FormActions note="El SLA inicia con la entrada física en taller, no con este alta.">
        <Button type="submit">Crear servicio</Button>
      </FormActions>
    </FormPanel>
  );
}
