"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormQuickModal, QuickCreateButton } from "@/components/form-quick-modal";
import { QuickClientFields } from "@/components/quick-client-fields";
import { controlClass, Field } from "@/components/ui";
import { quickCreateClientAction } from "@/lib/quick-create-actions";
import { validateQuickClientDraft, type QuickFormFieldMap } from "@/lib/quick-form-persist";

type ClientOption = { id: string; name: string };

export function ClientPicker({
  clients,
  allowQuickClient = false,
  defaultClientId = "",
  label = "Cliente",
  hint,
  onClientChange,
  onClientCreated,
  extendedContact = true,
}: {
  clients: ClientOption[];
  allowQuickClient?: boolean;
  defaultClientId?: string;
  label?: string;
  hint?: string;
  onClientChange?: (clientId: string) => void;
  onClientCreated?: (client: { id: string; name: string; contact: { id: string; name: string; isPrimary: boolean } }) => void;
  extendedContact?: boolean;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [extraClients, setExtraClients] = useState<ClientOption[]>([]);
  const options = useMemo(() => {
    const seen = new Set(clients.map((row) => row.id));
    return [...clients, ...extraClients.filter((row) => !seen.has(row.id))];
  }, [clients, extraClients]);

  const visibleOptions = useMemo(() => {
    const term = search.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!term) return options;
    return options.filter((row) => row.id === clientId || row.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(term));
  }, [options, search, clientId]);

  const selectClient = (id: string) => {
    setClientId(id);
    onClientChange?.(id);
    if (id) setShowNew(false);
  };

  const commitQuickClient = async (fields: QuickFormFieldMap) => {
    const validation = validateQuickClientDraft(fields);
    if (validation) return validation;
    const created = await quickCreateClientAction(fields);
    setExtraClients((current) => [...current, { id: created.clientId, name: created.name }]);
    onClientCreated?.({ id: created.clientId, name: created.name, contact: { id: created.primaryContactId, name: fields.contactName.trim(), isPrimary: true } });
    selectClient(created.clientId);
    router.refresh();
    return null;
  };

  return (
    <>
      <div className="grid gap-3">
        <input type="search" aria-label="Filtrar clientes de la lista" placeholder="Filtrar clientes por nombre…" value={search} onChange={(event) => setSearch(event.target.value)} className={controlClass} />
        <div className={allowQuickClient ? "flex flex-col gap-3 sm:flex-row sm:items-end" : undefined}>
        <Field
          label={label}
          hint={
            hint
            ?? (allowQuickClient
              ? "Elige de la lista o registra uno nuevo al lado."
              : undefined)
          }
          className={allowQuickClient ? "min-w-0 flex-1" : undefined}
        >
          <select
            name="clientId"
            required
            className={controlClass}
            value={clientId}
            disabled={showNew}
            onChange={(event) => selectClient(event.target.value)}
          >
            <option value="">Selecciona</option>
            {visibleOptions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </Field>
        {allowQuickClient && !clientId ? (
          <QuickCreateButton label="+ Alta de cliente" onClick={() => setShowNew(true)} />
        ) : null}
        </div>
        {search && visibleOptions.length === 0 ? <p className="text-xs text-[var(--muted)]">No hay coincidencias en la lista. Puedes dar de alta un cliente nuevo.</p> : null}
      </div>
      {allowQuickClient && !clientId ? (
        <>
          <FormQuickModal
            open={showNew}
            title="Alta de cliente"
            titleId="client-quick-modal-title"
            onClose={() => setShowNew(false)}
            onCommit={commitQuickClient}
            doneLabel="Guardar y continuar"
          >
            <QuickClientFields required extended={extendedContact} />
          </FormQuickModal>
        </>
      ) : null}
    </>
  );
}
