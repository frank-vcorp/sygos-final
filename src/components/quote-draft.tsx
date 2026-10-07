"use client";

import { useMemo, useState } from "react";
import { ClientPicker } from "@/components/client-picker";
import { SubmitButton } from "@/components/submit-button";
import { controlClass, Field } from "@/components/ui";

type Contact = { id: string; name: string; isPrimary: boolean };
type Client = { id: string; name: string; contacts: Contact[] };
type Gear = { id: string; folio: string; model: string; clientId: string };

export function QuoteDraft({
  clients,
  equipment,
  defaultClientId = "",
  allowQuickClient = false,
}: {
  clients: Client[];
  equipment: Gear[];
  defaultClientId?: string;
  allowQuickClient?: boolean;
}) {
  const [clientId, setClientId] = useState(defaultClientId);
  const [lines, setLines] = useState([{ concept: "", quantity: "1" }]);
  const client = clients.find((row) => row.id === clientId);
  const contacts = client?.contacts ?? [];
  const gear = useMemo(
    () => equipment.filter((row) => !clientId || row.clientId === clientId),
    [equipment, clientId],
  );
  const concepts = lines
    .map((line) => ({ concept: line.concept.replaceAll("|", " ").trim(), quantity: line.quantity.trim() || "1" }))
    .filter((line) => line.concept)
    .map((line) => `${line.concept}|${line.quantity}`)
    .join("\n");
  if (clients.length === 0 && !allowQuickClient) {
    return (
      <p className="rounded-md border border-[#efd0d0] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
        Primero da de alta un cliente con contacto. Sin eso no se puede cotizar.
      </p>
    );
  }

  return (
    <>
      <ClientPicker
        clients={clients}
        allowQuickClient={allowQuickClient}
        defaultClientId={defaultClientId}
        onClientChange={setClientId}
      />
      <Field
        label="Equipo existente"
        hint={
          !clientId
            ? "Selecciona un cliente para ver sus equipos."
            : "Vacío si todavía no ingresó, o si es servicio en campo o venta de equipo."
        }
      >
        <select name="equipmentId" className={controlClass} defaultValue="" disabled={!clientId}>
          <option value="">Sin equipo físico</option>
          {gear.map((item) => <option key={item.id} value={item.id}>{item.folio} · {item.model}</option>)}
        </select>
      </Field>
      <Field label="Tipo preliminar" hint="Obligatorio en diagnóstico o reparación si no eliges un equipo.">
        <input name="preliminaryType" className={controlClass} />
      </Field>
      <Field label="Marca preliminar"><input name="preliminaryBrand" className={controlClass} /></Field>
      <Field label="Modelo preliminar"><input name="preliminaryModel" className={controlClass} /></Field>
      <Field label="Serie preliminar"><input name="preliminarySerial" className={controlClass} /></Field>
      <div className="grid gap-2">
        <p className="text-sm font-medium">Conceptos</p>
        {lines.map((line, index) => (
          <div key={index} className="grid grid-cols-[minmax(0,1fr)_88px_auto] gap-2">
            <input
              aria-label={`Concepto ${index + 1}`}
              required={index === 0}
              value={line.concept}
              placeholder="Descripción"
              className={controlClass}
              onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, concept: event.target.value } : row))}
            />
            <input
              aria-label={`Cantidad ${index + 1}`}
              type="number"
              min={1}
              step={1}
              value={line.quantity}
              className={controlClass}
              onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))}
            />
            {lines.length > 1 ? (
              <button type="button" className="text-sm text-[var(--danger)]" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>Quitar</button>
            ) : <span />}
          </div>
        ))}
        <button type="button" className="w-fit text-sm font-medium text-[var(--accent)]" onClick={() => setLines((current) => [...current, { concept: "", quantity: "1" }])}>
          Agregar concepto
        </button>
        <input type="hidden" name="concepts" value={concepts} />
      </div>
      <Field label="Referencia comercial"><input name="reference" className={controlClass} /></Field>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Contactos destinatarios</legend>
        {!clientId ? <p className="text-xs text-[var(--muted)]">Elige el cliente para ver sus contactos. Hace falta al menos uno.</p> : null}
        {clientId && contacts.length === 0 ? <p className="text-sm text-[var(--danger)]">Este cliente no tiene contactos activos.</p> : null}
        {contacts.map((contact) => (
          <label key={contact.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="contactId" value={contact.id} defaultChecked={contact.isPrimary} />
            {contact.name}{contact.isPrimary ? " · principal" : ""}
          </label>
        ))}
      </fieldset>
      <SubmitButton pendingLabel="Guardando…">Guardar sin precio</SubmitButton>
    </>
  );
}
