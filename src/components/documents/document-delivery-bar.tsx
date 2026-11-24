"use client";

import { useMemo, useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass, inlineLinkClass, TextLink } from "@/components/ui";
import type { DeliveryIntegrationHint, DocumentDeliveryContact } from "@/lib/document-delivery-shared";
import { contactOptionsForDelivery } from "@/lib/document-delivery-shared";

type DeliveryAction = (formData: FormData) => void | Promise<void>;

export function DocumentDeliveryBar({
  printHref,
  showPrintLink = true,
  returnTo,
  quoteId,
  contacts,
  defaultSubject,
  defaultEmailBody,
  defaultWhatsAppBody,
  emailIntegration,
  whatsappIntegration,
  sendEmailAction,
  sendWhatsAppAction,
  layout = "inline",
}: {
  printHref?: string;
  showPrintLink?: boolean;
  returnTo: string;
  quoteId: string;
  contacts: DocumentDeliveryContact[];
  defaultSubject: string;
  defaultEmailBody: string;
  defaultWhatsAppBody: string;
  emailIntegration: DeliveryIntegrationHint;
  whatsappIntegration: DeliveryIntegrationHint;
  sendEmailAction: DeliveryAction;
  sendWhatsAppAction: DeliveryAction;
  layout?: "inline" | "toolbar";
}) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const options = useMemo(() => contactOptionsForDelivery(contacts), [contacts]);
  const emailContacts = options.filter((c) => c.email);
  const phoneContacts = options.filter((c) => c.phone);

  const separator = <span className="text-[var(--muted)]" aria-hidden>|</span>;

  const wrapClass = layout === "toolbar"
    ? "flex flex-wrap items-center gap-2 text-sm"
    : "inline-flex flex-wrap items-center gap-2";

  return (
    <>
      <div className={wrapClass}>
        {showPrintLink && printHref ? (
          <>
            <TextLink href={printHref}>Imprimir</TextLink>
            {separator}
          </>
        ) : null}
        <button type="button" className={inlineLinkClass} onClick={() => setEmailOpen(true)}>
          Correo
        </button>
        {separator}
        <button type="button" className={inlineLinkClass} onClick={() => setWaOpen(true)}>
          WhatsApp
        </button>
      </div>

      <FormOverlayDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        title="Enviar por correo"
        titleId="document-delivery-email"
      >
        <form action={sendEmailAction} className="grid gap-4 text-sm">
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {!emailIntegration.ready ? (
            <p className="rounded-md bg-[var(--warn-soft)] px-3 py-2 text-[var(--ink)]">{emailIntegration.message}</p>
          ) : null}
          {emailContacts.length > 0 ? (
            <fieldset className="grid gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Contactos del cliente</legend>
              {emailContacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2">
                  <input type="checkbox" name="contactEmail" value={contact.email!} defaultChecked={contact.isPrimary} />
                  <span>
                    {contact.name}
                    <span className="text-[var(--muted)]"> · {contact.email}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-[var(--muted)]">Este cliente no tiene contactos con correo. Captura uno o usa el campo adicional.</p>
          )}
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-[var(--ink)]">Correos adicionales</span>
            <input name="extraEmail" type="text" placeholder="otro@empresa.com, copia@…" className={controlClass} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-[var(--ink)]">Asunto</span>
            <input name="subject" type="text" defaultValue={defaultSubject} className={controlClass} required />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-[var(--ink)]">Mensaje</span>
            <textarea name="body" rows={5} defaultValue={defaultEmailBody} className={controlClass} />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setEmailOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={!emailIntegration.ready}>Enviar correo</Button>
          </div>
        </form>
      </FormOverlayDialog>

      <FormOverlayDialog
        open={waOpen}
        onClose={() => setWaOpen(false)}
        title="Enviar por WhatsApp"
        titleId="document-delivery-whatsapp"
      >
        <form action={sendWhatsAppAction} className="grid gap-4 text-sm">
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          {!whatsappIntegration.ready ? (
            <p className="rounded-md bg-[var(--warn-soft)] px-3 py-2 text-[var(--ink)]">{whatsappIntegration.message}</p>
          ) : null}
          {phoneContacts.length > 0 ? (
            <fieldset className="grid gap-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Contactos del cliente</legend>
              {phoneContacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2">
                  <input type="checkbox" name="contactPhone" value={contact.phone!} defaultChecked={contact.isPrimary} />
                  <span>
                    {contact.name}
                    <span className="text-[var(--muted)]"> · {contact.phone}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-[var(--muted)]">Este cliente no tiene teléfonos en contactos. Usa el campo adicional.</p>
          )}
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-[var(--ink)]">Teléfonos adicionales</span>
            <input name="extraPhone" type="text" placeholder="81…, +52…" className={controlClass} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-[var(--ink)]">Mensaje</span>
            <textarea name="whatsAppBody" rows={4} defaultValue={defaultWhatsAppBody} className={controlClass} />
          </label>
          <p className="text-xs text-[var(--muted)]">En P1 se envía texto con enlace al documento imprimible (sin PDF adjunto).</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setWaOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={!whatsappIntegration.ready}>Enviar WhatsApp</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}