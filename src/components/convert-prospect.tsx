"use client";

import { useState } from "react";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { controlClass, Field } from "@/components/ui";

export function ConvertProspect({
  prospectId,
  version,
  clients,
  convertAction,
  discardAction,
}: {
  prospectId: string;
  version: number;
  clients: Array<{ id: string; name: string }>;
  convertAction: (formData: FormData) => void | Promise<void>;
  discardAction: (formData: FormData) => void | Promise<void>;
}) {
  const [mode, setMode] = useState("nuevo");
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <form action={convertAction} className="space-y-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <input type="hidden" name="id" value={prospectId} />
        <input type="hidden" name="version" value={version} />
        <h2 className="font-medium">Convertir</h2>
        <Field label="Destino">
          <select name="mode" className={controlClass} value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="nuevo">Crear cliente nuevo</option>
            <option value="existente">Usar cliente existente</option>
          </select>
        </Field>
        {mode === "nuevo" ? (
          <Field label="Contacto del cliente nuevo" hint="Obligatorio al crear el cliente.">
            <input name="contactName" required className={controlClass} />
          </Field>
        ) : (
          <Field label="Cliente existente">
            <select name="clientId" required className={controlClass} defaultValue="">
              <option value="">Selecciona</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </Field>
        )}
        <SubmitButton>Convertir a cliente</SubmitButton>
      </form>
      <form action={discardAction} className="space-y-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <input type="hidden" name="id" value={prospectId} />
        <input type="hidden" name="version" value={version} />
        <h2 className="font-medium">Descartar</h2>
        <Field label="Motivo"><input name="reason" required className={controlClass} /></Field>
        <ConfirmSubmit message="El prospecto quedará descartado. El historial se conserva.">Descartar</ConfirmSubmit>
      </form>
    </div>
  );
}
