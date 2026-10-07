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
  extendedContact = true,
}: {
  clients: ClientOption[];
  allowQuickClient?: boolean;
  defaultClientId?: string;
  label?: string;
  hint?: string;
  onClientChange?: (clientId: string) => void;
  extendedContact?: boolean;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(defaultClientId);
  const [showNew, setShowNew] = useState(false);
  const [extraClients, setExtraClients] = useState<ClientOption[]>([]);
  const options = useMemo(() => {
    const seen = new Set(clients.map((row) => row.id));
    return [...clients, ...extraClients.filter((row) => !seen.has(row.id))];
  }, [clients, extraClients]);

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
    selectClient(created.clientId);
    return null;
  };

  return (
    <>
      <Field
        label={label}
        hint={
          hint
          ?? (allowQuickClient
            ? "Elige un cliente de la lista o usa el alta si aún no existe."
            : undefined)
        }
      >
        <select
          name="clientId"
          required={!allowQuickClient}
          className={controlClass}
          value={clientId}
          disabled={showNew}
          onChange={(event) => selectClient(event.target.value)}
        >
          <option value="">Selecciona</option>
          {options.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
      </Field>
      {allowQuickClient && !clientId ? (
        <>
          <QuickCreateButton label="+ Alta de cliente" onClick={() => setShowNew(true)} />
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
