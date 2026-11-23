"use client";

import { useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, TextLink } from "@/components/ui";
import { CLIENT_FISCAL_INVOICE_BLOCK_MESSAGE, clientFiscalReady, type ClientFiscalInput } from "@/lib/client-fiscal";

type RequestDocumentAction = (formData: FormData) => void | Promise<void>;

export function QuoteBillingRequestActions({
  quoteId,
  client,
  canEditClient,
  requestDocumentAction,
}: {
  quoteId: string;
  client: ClientFiscalInput & { id: string };
  canEditClient: boolean;
  requestDocumentAction: RequestDocumentAction;
}) {
  const [fiscalBlockOpen, setFiscalBlockOpen] = useState(false);
  const fiscalReady = clientFiscalReady(client);

  return (
    <>
      <form action={requestDocumentAction} className="inline">
        <input type="hidden" name="quoteId" value={quoteId} />
        <input type="hidden" name="kind" value="REMISION" />
        <Button type="submit" tone="ghost">Solicitar remisión</Button>
      </form>
      {fiscalReady ? (
        <form action={requestDocumentAction} className="inline">
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="kind" value="FACTURA" />
          <Button type="submit" tone="ghost">Solicitar factura</Button>
        </form>
      ) : (
        <Button type="button" tone="ghost" onClick={() => setFiscalBlockOpen(true)}>
          Solicitar factura
        </Button>
      )}
      <FormOverlayDialog
        open={fiscalBlockOpen}
        onClose={() => setFiscalBlockOpen(false)}
        title="Faltan datos fiscales"
        titleId="quote-fiscal-block-dialog"
      >
        <div className="grid gap-4 text-sm">
          <p className="text-[var(--muted)]">{CLIENT_FISCAL_INVOICE_BLOCK_MESSAGE}</p>
          {canEditClient ? (
            <p>
              <TextLink href={`/clientes/${client.id}#contactos`}>Capturar datos fiscales del cliente</TextLink>
            </p>
          ) : (
            <p className="text-[var(--muted)]">Pide a coordinación o administración que completen la ficha fiscal del cliente.</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setFiscalBlockOpen(false)}>Cerrar</Button>
            <form action={requestDocumentAction} className="inline">
              <input type="hidden" name="quoteId" value={quoteId} />
              <input type="hidden" name="kind" value="REMISION" />
              <Button type="submit" tone="ghost">Solicitar remisión</Button>
            </form>
          </div>
        </div>
      </FormOverlayDialog>
    </>
  );
}