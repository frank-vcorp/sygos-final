"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupplierModalAction, type CreateSupplierState } from "./actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass, Field, FormActions, FormSection } from "@/components/ui";

const initialState: CreateSupplierState = { status: "idle" };

export function SupplierCreateModal() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.querySelector("button")?.focus());
  }

  return (
    <>
      <div ref={triggerRef}>
        <Button type="button" onClick={() => setOpen(true)}>
          Nuevo proveedor
        </Button>
      </div>
      {open ? <SupplierCreateDialog onClose={close} /> : null}
    </>
  );
}

function SupplierCreateDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createSupplierModalAction, initialState);
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <FormOverlayDialog open onClose={onClose} title="Nuevo proveedor" titleId="supplier-create-dialog" wide>
      <form action={formAction}>
        <FormSection
          title="Datos generales"
          description="Nombre y moneda son necesarios para registrar el proveedor."
        >
          <Field label="Nombre o razón social">
            <input ref={nameRef} name="name" required className={controlClass} />
          </Field>
          <Field label="Moneda">
            <select name="currency" required defaultValue="MXN" className={controlClass}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </Field>
        </FormSection>
        <details
          className="group border-b border-[var(--line)]"
          open={showOptional}
          onToggle={(event) => setShowOptional(event.currentTarget.open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-sm font-semibold text-[var(--ink)] md:px-8 [&::-webkit-details-marker]:hidden">
            <span>Agregar datos fiscales y condiciones comerciales <span className="font-normal text-[var(--muted)]">(opcional)</span></span>
            <span className="text-xs text-[var(--muted)] transition-transform group-open:rotate-180">▼</span>
          </summary>
          <FormSection title="Datos comerciales" description="Puedes completarlos ahora o antes de una compra o pago.">
            <Field label="Categoría"><input name="category" className={controlClass} /></Field>
            <Field label="Contacto"><input name="contactName" className={controlClass} /></Field>
            <Field label="Teléfono"><input name="phone" className={controlClass} /></Field>
            <Field label="Correo"><input name="email" type="email" className={controlClass} /></Field>
            <Field label="RFC"><input name="rfc" className={controlClass} /></Field>
            <Field label="Días de crédito"><input name="creditDays" type="number" min="0" className={controlClass} /></Field>
            <Field label="Emite factura fiscal">
              <select name="issuesInvoice" className={controlClass} defaultValue="">
                <option value="">Definir después</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Domicilio fiscal"><textarea name="fiscalAddress" rows={3} className={controlClass} /></Field>
            </div>
          </FormSection>
        </details>
        {state.status === "error" ? (
          <p className="px-5 pt-4 text-sm text-[var(--danger)]" role="alert">
            {state.message}
          </p>
        ) : null}
        <FormActions>
          <Button type="button" tone="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar proveedor"}
          </Button>
        </FormActions>
      </form>
    </FormOverlayDialog>
  );
}
