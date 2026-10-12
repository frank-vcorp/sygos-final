"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { QuickClientFields } from "@/components/quick-client-fields";
import { SearchableEntityPicker, type PickerOption } from "@/components/searchable-entity-picker";
import { Button } from "@/components/ui";
import { quickCreateClientAction } from "@/lib/quick-create-actions";
import { readNamedFormFields, validateQuickClientDraft, type QuickFormFieldMap } from "@/lib/quick-form-persist";

export function ClientPicker({
  clients, allowQuickClient = false, defaultClientId = "", label = "Cliente", hint,
  onClientChange, onClientCreated, extendedContact = true,
}: {
  clients: PickerOption[];
  allowQuickClient?: boolean;
  defaultClientId?: string;
  label?: string;
  hint?: string;
  onClientChange?: (clientId: string) => void;
  onClientCreated?: (client: { id: string; name: string; contact: { id: string; name: string; isPrimary: boolean } }) => void;
  extendedContact?: boolean;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState(defaultClientId);
  const [showNew, setShowNew] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [extraClients, setExtraClients] = useState<PickerOption[]>([]);
  const seen = new Set(clients.map((row) => row.id));
  const options = [...clients, ...extraClients.filter((row) => !seen.has(row.id))];

  function selectClient(id: string) {
    setClientId(id);
    onClientChange?.(id);
    if (id) setShowNew(false);
  }

  async function saveClient() {
    if (saving || !panelRef.current) return;
    for (const input of panelRef.current.querySelectorAll<HTMLInputElement>("input")) {
      if (!input.reportValidity()) return;
    }
    const fields: QuickFormFieldMap = readNamedFormFields(panelRef.current);
    const validation = validateQuickClientDraft(fields);
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError("");
    try {
      const created = await quickCreateClientAction(fields);
      setExtraClients((current) => [...current, { id: created.clientId, name: created.name }]);
      onClientCreated?.({ id: created.clientId, name: created.name, contact: { id: created.primaryContactId, name: fields.contactName.trim(), isPrimary: true } });
      selectClient(created.clientId);
      setShowNew(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear el cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <SearchableEntityPicker
        label={label}
        name="clientId"
        options={options}
        selectedId={clientId}
        onSelect={selectClient}
        required
        hint={hint ?? (allowQuickClient ? "Busca en el mismo campo o agrega un cliente nuevo." : undefined)}
        emptyLabel="Busca o selecciona un cliente"
        createLabel="Nuevo cliente"
        onCreate={allowQuickClient ? (typed) => {
          selectClient("");
          setDraftName(typed);
          setError("");
          setShowNew(true);
        } : undefined}
      />
      {showNew ? (
        <div ref={panelRef} className="grid gap-3 rounded-xl border border-[#bed9e9] bg-[#f4f9fc] p-4"
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
              event.preventDefault();
              void saveClient();
            }
          }}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--ink)]">Nuevo cliente</h3>
            <Button type="button" tone="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
          </div>
          <QuickClientFields required extended={extendedContact} defaultName={draftName} />
          {error ? <p role="alert" className="text-sm text-[var(--danger)]">{error}</p> : null}
          <Button type="button" disabled={saving} onClick={() => void saveClient()}>{saving ? "Guardando…" : "Guardar cliente y continuar"}</Button>
        </div>
      ) : null}
    </div>
  );
}
