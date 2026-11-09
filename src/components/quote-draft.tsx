"use client";

import { useMemo, useState } from "react";
import { filterDiagnosisPrioritiesForEquipment, type DiagnosisPriorityOption } from "@/lib/diagnosis-priorities-shared";
import { ContactNameLink } from "@/components/client-entity-links";
import { ClientPicker } from "@/components/client-picker";
import { ServiceEquipmentPicker, type ServiceEquipmentOption } from "@/components/service-equipment-picker";
import { controlClass, Field, FormBlock } from "@/components/ui";
import { QUOTE_TYPES, QUOTE_TYPE_LABEL, type QuoteType } from "@/lib/quote-meta";
import { prioritySummary } from "@/lib/priorities";

type Contact = { id: string; name: string; isPrimary: boolean };
type Client = { id: string; name: string; contacts: Contact[] };
type PriorityOption = DiagnosisPriorityOption;

export function QuoteDraft({
  clients,
  equipment,
  defaultClientId = "",
  allowQuickClient = false,
  allowQuickEquipment = false,
  quickEquipmentKinds,
  canEditClient = false,
  companyCode,
  types,
  brands,
  models,
  fixedQuoteType,
  diagnosisPriorities = [],
}: {
  clients: Client[];
  equipment: ServiceEquipmentOption[];
  defaultClientId?: string;
  allowQuickClient?: boolean;
  allowQuickEquipment?: boolean;
  quickEquipmentKinds?: Array<"EQUI" | "MOT">;
  canEditClient?: boolean;
  companyCode: string;
  types: string[];
  brands: string[];
  models: Array<{ type: string; brand: string; model: string }>;
  fixedQuoteType?: QuoteType;
  diagnosisPriorities?: PriorityOption[];
}) {
  const [clientId, setClientId] = useState(defaultClientId);
  const [createdClients, setCreatedClients] = useState<Client[]>([]);
  const [quoteType, setQuoteType] = useState<QuoteType>(fixedQuoteType ?? "DIAGNOSTICO");
  const [equipmentKind, setEquipmentKind] = useState<"EQUI" | "MOT">(quickEquipmentKinds?.[0] ?? "EQUI");
  const filteredDiagnosisPriorities = useMemo(
    () => filterDiagnosisPrioritiesForEquipment(diagnosisPriorities, companyCode, equipmentKind),
    [diagnosisPriorities, companyCode, equipmentKind],
  );
  const client = [...clients, ...createdClients].find((row) => row.id === clientId);
  const contacts = client?.contacts ?? [];
  const requiresEquipment = quoteType === "DIAGNOSTICO" || quoteType === "REPARACION";
  const requiresDiagnosisPriority = quoteType === "DIAGNOSTICO" && !fixedQuoteType;
  if (clients.length === 0 && !allowQuickClient) {
    return (
      <p className="rounded-md border border-[#efd0d0] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
        Primero da de alta un cliente con contacto. Sin eso no se puede cotizar.
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      <FormBlock title="1. Tipo y cliente" description="Define el servicio y a quién irá dirigida la propuesta." columns={1}>
        {fixedQuoteType ? <input type="hidden" name="quoteType" value={fixedQuoteType} /> : (
          <Field label="Tipo de cotización" hint="Elige el tipo antes de capturar el equipo.">
            <select name="quoteType" className={controlClass} value={quoteType} onChange={(event) => setQuoteType(event.target.value as QuoteType)} required>
              {QUOTE_TYPES.map((type) => <option key={type} value={type}>{QUOTE_TYPE_LABEL[type]}</option>)}
            </select>
          </Field>
        )}
        {requiresDiagnosisPriority ? (
          <Field label="Prioridad del diagnóstico" hint="Obligatoria en COTDX; se hereda al abrir el DX.">
            <select name="priorityId" className={controlClass} required defaultValue="">
              <option value="">Selecciona</option>
              {filteredDiagnosisPriorities.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <ClientPicker
          clients={clients}
          allowQuickClient={allowQuickClient}
          defaultClientId={defaultClientId}
          onClientChange={setClientId}
          onClientCreated={(created) => setCreatedClients((current) => [...current, { id: created.id, name: created.name, contacts: [created.contact] }])}
        />
      </FormBlock>

      <FormBlock title="2. Equipo" description={requiresEquipment ? "El catálogo solo sugiere tipo, marca y modelo para la etiqueta. Siempre se crea un folio nuevo; para un EQUI ya registrado abre el servicio desde su ficha." : "Relaciona un equipo si aplica. Puedes continuar sin uno."} columns={1}>
        <ServiceEquipmentPicker
          equipment={equipment}
          clientId={clientId}
          companyCode={companyCode}
          types={types}
          brands={brands}
          models={models}
          allowQuickEquipment={allowQuickEquipment}
          quickEquipmentKinds={quickEquipmentKinds}
          onEquipmentKindChange={setEquipmentKind}
          emptyOptionLabel="Sin equipo físico"
          required={requiresEquipment}
        />
      </FormBlock>

      <FormBlock title="3. Destinatarios y referencia" description="Selecciona al menos un contacto. La referencia interna es opcional." columns={2}>
        <Field label="Referencia comercial" hint="Folio del cliente, orden de compra, etc.">
          <input name="reference" className={controlClass} placeholder="Opcional" />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium">Contactos destinatarios</p>
          {!clientId ? (
            <p className="rounded-lg border border-dashed border-[var(--line)] bg-[#f7fafc] px-3 py-4 text-sm text-[var(--muted)]">
              Elige un cliente para marcar quién recibe la cotización.
            </p>
          ) : null}
          {clientId && contacts.length === 0 ? (
            <p className="rounded-lg border border-[#efd0d0] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
              Este cliente no tiene contactos activos. Agrégalos en el detalle del cliente.
            </p>
          ) : null}
          {contacts.length > 0 ? <ContactChoices key={clientId} clientId={clientId} contacts={contacts} canEditClient={canEditClient} /> : null}
        </div>
      </FormBlock>
    </div>
  );
}


function ContactChoices({ clientId, contacts, canEditClient }: { clientId: string; contacts: Contact[]; canEditClient: boolean }) {
  const [selected, setSelected] = useState<string[]>(contacts.filter((contact) => contact.isPrimary).map((contact) => contact.id));
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {contacts.map((contact, index) => (
        <li key={contact.id}>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-3 transition-colors has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]">
            <input
              type="checkbox"
              name="contactId"
              value={contact.id}
              checked={selected.includes(contact.id)}
              required={selected.length === 0 && index === 0}
              onChange={(event) => setSelected((current) => event.target.checked ? [...current, contact.id] : current.filter((id) => id !== contact.id))}
              className="mt-1"
            />
            <span className="text-sm leading-snug">
              <ContactNameLink clientId={clientId} name={contact.name} />
              {contact.isPrimary ? <span className="mt-0.5 block text-xs text-[var(--muted)]">Contacto principal</span> : null}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
