"use client";

import { useMemo, useState } from "react";
import type { EquipmentCatalogByKind } from "@/lib/catalog";
import { filterDiagnosisPrioritiesForEquipment, type DiagnosisPriorityOption } from "@/lib/diagnosis-priorities-shared";
import { ClientPicker } from "@/components/client-picker";
import { ServiceEquipmentPicker, type ServiceEquipmentOption } from "@/components/service-equipment-picker";
import { Button, controlClass, Field, FormActions, FormBlock, FormPanel } from "@/components/ui";

type PriorityOption = DiagnosisPriorityOption;
type RepairOption = { id: string; folio: string; clientOwnerUserId?: string | null };
type ClientOption = { id: string; name: string; ownerUserId?: string | null };
type SellerOption = { id: string; name: string };

function matchingSellerId(ownerUserId: string | null | undefined, sellers: SellerOption[]) {
  if (!ownerUserId) return "";
  return sellers.some((seller) => seller.id === ownerUserId) ? ownerUserId : "";
}

export function ServiceStartForm({
  action,
  attentionType,
  clients,
  equipment,
  priorities,
  types,
  brands,
  models,
  catalogByKind,
  repairs,
  sellers = [],
  canSelectSeller = false,
  canEditOrderDate = false,
  canConfirmPhysicalReceipt = false,
  canCaptureLegacyFolio = false,
  defaultCreatedAt = "",
  defaultClientId,
  companyCode,
  allowQuickClient,
  allowQuickEquipment = true,
  quickEquipmentKinds,
  warranty,
  hidePriority = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  attentionType: string;
  clients: ClientOption[];
  equipment: ServiceEquipmentOption[];
  priorities: PriorityOption[];
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
  catalogByKind?: EquipmentCatalogByKind;
  repairs: RepairOption[];
  sellers?: SellerOption[];
  canSelectSeller?: boolean;
  canEditOrderDate?: boolean;
  canConfirmPhysicalReceipt?: boolean;
  canCaptureLegacyFolio?: boolean;
  defaultCreatedAt?: string;
  defaultClientId: string;
  companyCode: string;
  allowQuickClient: boolean;
  allowQuickEquipment?: boolean;
  quickEquipmentKinds?: Array<"EQUI" | "MOT">;
  warranty: boolean;
  hidePriority?: boolean;
}) {
  const [clientId, setClientId] = useState(defaultClientId);
  const [sellerUserId, setSellerUserId] = useState(() => {
    const initialClient = clients.find((c) => c.id === defaultClientId);
    return matchingSellerId(initialClient?.ownerUserId, sellers);
  });
  const [equipmentKind, setEquipmentKind] = useState<"EQUI" | "MOT">(quickEquipmentKinds?.[0] ?? "EQUI");
  const visiblePriorities = useMemo(
    () => (attentionType === "DIAGNOSTICO" ? filterDiagnosisPrioritiesForEquipment(priorities, companyCode, equipmentKind) : priorities),
    [attentionType, priorities, companyCode, equipmentKind],
  );

  function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    const selected = clients.find((c) => c.id === nextClientId);
    setSellerUserId(matchingSellerId(selected?.ownerUserId, sellers));
  }

  function handleRepairChange(nextRepairId: string) {
    const repair = repairs.find((r) => r.id === nextRepairId);
    if (repair) setSellerUserId(matchingSellerId(repair.clientOwnerUserId, sellers));
  }

  return (
    <FormPanel action={action} className="mx-auto max-w-6xl">
      <input type="hidden" name="attentionType" value={attentionType} />
      <div className="grid gap-5 p-5 md:p-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(330px,0.85fr)]">
        <FormBlock
          title={warranty ? "1. Equipo" : "1. Cliente y equipo"}
          description={warranty ? "El cliente se infiere de la reparación de origen." : "El catálogo solo sugiere la etiqueta; siempre se crea un folio nuevo para el servicio."}
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
              onClientChange={handleClientChange}
            />
          )}
          <ServiceEquipmentPicker
            equipment={equipment}
            clientId={clientId}
            companyCode={companyCode}
            types={types}
            brands={brands}
            models={models}
            catalogByKind={catalogByKind}
            warranty={warranty}
            allowQuickEquipment={allowQuickEquipment}
            quickEquipmentKinds={quickEquipmentKinds}
            onEquipmentKindChange={setEquipmentKind}
          />
        </FormBlock>

        <FormBlock
          title="2. Datos del servicio"
          description={hidePriority ? "Describe el motivo del ingreso." : "Define la prioridad y describe el motivo del ingreso."}
          columns={1}
        >
          {hidePriority ? null : (
            <Field label="Prioridad">
              <select name="priorityId" required className={controlClass}>
                <option value="">Selecciona</option>
                {visiblePriorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.label ?? priority.name}</option>)}
              </select>
            </Field>
          )}
          {canSelectSeller ? (
            <Field label="Vendedor" hint="Por defecto usa el vendedor asignado al cliente; puedes elegir otro vendedor activo.">
              <select
                name="sellerUserId"
                value={sellerUserId}
                onChange={(event) => setSellerUserId(event.target.value)}
                className={controlClass}
              >
                <option value="">Sin vendedor asignado</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>{seller.name}</option>
                ))}
              </select>
            </Field>
          ) : null}
          {canEditOrderDate ? (
            <Field label="Fecha de creación de orden" hint="Opcional. Por defecto usa la fecha y hora actual.">
              <input
                name="createdAt"
                type="datetime-local"
                defaultValue={defaultCreatedAt}
                className={controlClass}
              />
            </Field>
          ) : null}
          {canConfirmPhysicalReceipt && equipmentKind === "EQUI" ? (
            <label className="flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[#f8fbfd] px-3.5 py-3 text-sm">
              <input
                type="checkbox"
                name="confirmPhysicalReceipt"
                value="si"
                className="mt-1 h-4 w-4 rounded border-[#cbd8e6] text-[var(--accent)]"
              />
              <span>
                <span className="block font-medium text-[var(--ink)]">Confirmar ingreso físico al taller con esta misma fecha</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                  Registra la entrada en almacén (ENT) e inicia el SLA y el folio técnico usando la fecha de creación indicada arriba.
                </span>
              </span>
            </label>
          ) : null}
          {canCaptureLegacyFolio ? (
            <Field label="Folio del sistema anterior" hint="Opcional. Referencia del folio histórico; Sygos generará su propio folio consecutivo.">
              <input name="legacyFolio" placeholder="Ej. OS-1234" className={controlClass} />
            </Field>
          ) : null}
          <Field label="Falla reportada" hint="Describe el síntoma o problema que reporta el cliente.">
            <textarea name="reportedFault" required rows={4} className={controlClass} />
          </Field>
          {warranty ? (
            <>
              <Field label="Reparación pagada de origen">
                <select name="originalCaseId" required className={controlClass} onChange={(event) => handleRepairChange(event.target.value)}>
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
            <Field label="Bitácora inicial" hint="Registra el contexto, motivo o cualquier dato importante para el equipo técnico.">
              <textarea name="initialLog" rows={3} className={controlClass} placeholder="Escribe la primera nota del servicio" />
            </Field>
          </div>
        </details>
      </div>
      <FormActions note={hidePriority ? "Primero guarda la identificación del equipo; la orden entra directo sin plazo SLA." : "Primero guarda la identificación del equipo; el SLA inicia con la entrada física en Almacén."}>
        <Button type="submit">Crear servicio</Button>
      </FormActions>
    </FormPanel>
  );
}
