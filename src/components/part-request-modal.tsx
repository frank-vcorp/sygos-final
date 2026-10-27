"use client";

import { useRef, useState } from "react";
import { PartInventoryFields } from "@/components/part-inventory-fields";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass, Field } from "@/components/ui";

type RequestPartAction = (formData: FormData) => void | Promise<void>;

export function PartRequestModal({
  caseId,
  inventoryEnabled,
  requestPartAction,
}: {
  caseId: string;
  inventoryEnabled: boolean;
  requestPartAction: RequestPartAction;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.querySelector("button")?.focus());
  };

  return (
    <>
      <div ref={triggerRef} className="mt-3">
        <Button type="button" onClick={() => setOpen(true)}>
          Solicitar refacción
        </Button>
      </div>
      <FormOverlayDialog
        open={open}
        onClose={close}
        title="Solicitar refacción"
        titleId="part-request-dialog"
      >
        <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
          Registra una solicitud formal de refacción para esta orden de servicio.
        </p>
        <form action={requestPartAction} className="grid gap-3">
          <input type="hidden" name="caseId" value={caseId} />
          <input type="hidden" name="scrollAnchor" value="refacciones" />
          <PartInventoryFields inventoryEnabled={inventoryEnabled} />
          <Field label="Liga opcional">
            <input name="link" className={controlClass} />
          </Field>
          <Field label="Cantidad">
            <input name="quantity" type="number" min={1} required className={controlClass} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4">
            <Button type="button" tone="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit">Registrar solicitud</Button>
          </div>
        </form>
      </FormOverlayDialog>
    </>
  );
}
