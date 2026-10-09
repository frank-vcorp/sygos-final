"use client";

import { useState } from "react";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";

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
      <FormPanel action={convertAction}>
        <input type="hidden" name="id" value={prospectId} />
        <input type="hidden" name="version" value={version} />
        <FormSection title="Convertir" columns={1}>
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
        </FormSection>
        <FormActions><SubmitButton>Convertir a cliente</SubmitButton></FormActions>
      </FormPanel>
      <FormPanel action={discardAction}>
        <input type="hidden" name="id" value={prospectId} />
        <input type="hidden" name="version" value={version} />
        <FormSection title="Descartar" columns={1}>
          <Field label="Motivo"><input name="reason" required className={controlClass} /></Field>
        </FormSection>
        <FormActions>
          <ConfirmSubmit message="El prospecto quedará descartado. El historial se conserva.">Descartar</ConfirmSubmit>
        </FormActions>
      </FormPanel>
    </div>
  );
}
