"use client";

import { useState } from "react";
import { QuickClientFields } from "@/components/quick-client-fields";
import { QuickPanel } from "@/components/quick-panel";
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
  const quick = allowQuickClient && !clientId;

  return (
    <>
      <Field
        label={label}
        hint={hint ?? (allowQuickClient ? "Elige uno existente o da de alta uno nuevo sin salir de este formulario." : undefined)}
      >
        <select
          name="clientId"
          required={!allowQuickClient}
          className={controlClass}
          value={clientId}
          onChange={(event) => {
            setClientId(event.target.value);
            onClientChange?.(event.target.value);
          }}
        >
          {allowQuickClient ? <option value="">Crear cliente en este paso</option> : <option value="">Selecciona</option>}
          {clients.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </select>
      </Field>
      {allowQuickClient ? (
        <QuickPanel label="Alta rápida de cliente" defaultOpen={clients.length === 0 || quick}>
          <QuickClientFields required={quick} extended={extendedContact} />
        </QuickPanel>
      ) : null}
    </>
  );
}
