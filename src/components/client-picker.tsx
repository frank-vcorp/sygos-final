"use client";

import { useState } from "react";
import { FormQuickModal, QuickCreateButton } from "@/components/form-quick-modal";
import { QuickClientFields } from "@/components/quick-client-fields";
import { controlClass, Field } from "@/components/ui";

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
  const [clientId, setClientId] = useState(defaultClientId);
  const [showNew, setShowNew] = useState(false);
  const quick = allowQuickClient && !clientId;

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
          onChange={(event) => {
            const next = event.target.value;
            setClientId(next);
            onClientChange?.(next);
            if (next) setShowNew(false);
          }}
        >
          <option value="">Selecciona</option>
          {clients.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
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
            doneLabel="Listo — continuar"
          >
            <QuickClientFields required={quick} extended={extendedContact} />
          </FormQuickModal>
        </>
      ) : null}
    </>
  );
}
