"use client";

import { useState } from "react";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass } from "@/components/ui";

type DecideAction = (formData: FormData) => void | Promise<void>;

type QuoteLine = {
  id: string;
  concept: string;
};

/**
 * Resolves the client's answer where it is most useful: in the detail header.
 * A rejection requires context, while equipment sales retain line-by-line approval.
 */
export function QuoteDecisionActions({
  quoteId,
  version,
  quoteType,
  lines,
  decideAction,
  discountPct = 0,
}: {
  quoteId: string;
  version: number;
  quoteType: string;
  lines: QuoteLine[];
  decideAction: DecideAction;
  /** Descuento comercial vigente; se guarda al autorizar si el vendedor no pulsó Aplicar antes. */
  discountPct?: number;
}) {
  const [open, setOpen] = useState<null | "authorize" | "reject">(null);
  const needsLineSelection = quoteType === "VENTA_EQUIPO";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {needsLineSelection ? (
          <Button type="button" onClick={() => setOpen("authorize")}>Autorizada</Button>
        ) : (
          <form action={decideAction} className="inline">
            <input type="hidden" name="quoteId" value={quoteId} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="decision" value="si" />
            <input type="hidden" name="discountPct" value={discountPct} />
            <Button type="submit">Autorizada</Button>
          </form>
        )}
        <Button type="button" tone="danger" onClick={() => setOpen("reject")}>No autorizada</Button>
      </div>

      <FormOverlayDialog
        open={open === "authorize"}
        onClose={() => setOpen(null)}
        title="Autorizar conceptos"
        titleId="quote-authorize-dialog"
      >
        <form action={decideAction} className="grid gap-4">
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="decision" value="si" />
          <input type="hidden" name="discountPct" value={discountPct} />
          <div className="grid gap-2">
            <p className="text-sm text-[var(--muted)]">Selecciona los conceptos que autorizó el cliente.</p>
            {lines.map((line) => (
              <label key={line.id} className="flex items-center gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm">
                <input type="checkbox" name="authorizedLine" value={line.id} />
                {line.concept}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button type="submit">Registrar autorización</Button>
          </div>
        </form>
      </FormOverlayDialog>

      <FormOverlayDialog
        open={open === "reject"}
        onClose={() => setOpen(null)}
        title="No autorizada"
        titleId="quote-reject-dialog"
      >
        <form action={decideAction} className="grid gap-4">
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="decision" value="no" />
          <div>
            <label htmlFor="quote-rejection-reason" className="text-sm font-medium text-[#0b1f3a]">Motivo</label>
            <textarea
              id="quote-rejection-reason"
              name="reason"
              required
              rows={4}
              className={`mt-1 ${controlClass}`}
              placeholder="Indica por qué el cliente no autorizó la cotización"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" tone="ghost" onClick={() => setOpen(null)}>Cancelar</Button>
            <Button type="submit" tone="danger">Registrar no autorización</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
