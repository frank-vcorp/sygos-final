"use client";

import { useState } from "react";
import { SearchableEntityPicker } from "@/components/searchable-entity-picker";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { controlClass, Field, FormActions, FormPanel, FormSection } from "@/components/ui";

export function ConvertProspect({
  prospectId,
  version,
  clients,
  defaultContactName = "",
  defaultContactPhone = "",
  convertAction,
  discardAction,
}: {
  prospectId: string;
  version: number;
  clients: Array<{ id: string; name: string }>;
  defaultContactName?: string;
  defaultContactPhone?: string;
  convertAction: (formData: FormData) => void | Promise<void>;
  discardAction: (formData: FormData) => void | Promise<void>;
}) {
  const [mode, setMode] = useState("nuevo");
  const [clientId, setClientId] = useState("");
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
            <>
              <Field label="Nombre del contacto" hint="Obligatorio al crear el cliente.">
                <input name="contactName" required className={controlClass} defaultValue={defaultContactName} />
              </Field>
              <Field label="Teléfono del contacto" hint="Obligatorio al crear el cliente.">
                <input name="contactPhone" required className={controlClass} defaultValue={defaultContactPhone} />
              </Field>
            </>
          ) : (
            <SearchableEntityPicker label="Cliente existente" name="clientId" options={clients} selectedId={clientId} onSelect={setClientId} required emptyLabel="Busca o selecciona un cliente" />
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
