"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createRequirementAction, type CreateRequirementState } from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass, Field, FormActions, FormSection } from "@/components/ui";

const initialState: CreateRequirementState = { status: "idle" };

export function RequirementCreateModal() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.querySelector("button")?.focus());
  };

  return (
    <>
      <div ref={triggerRef}>
        <Button type="button" onClick={() => setOpen(true)}>
          Nuevo requerimiento
        </Button>
      </div>
      {open ? <RequirementCreateDialog onClose={close} /> : null}
    </>
  );
}

function RequirementCreateDialog({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createRequirementAction, initialState);
  const router = useRouter();
  const partNumberRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"GENERAL" | "REFACCION">("GENERAL");

  useEffect(() => {
    partNumberRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <FormOverlayDialog
      open
      onClose={onClose}
      title="Nuevo requerimiento"
      titleId="requirement-create-dialog"
    >
      <form action={formAction}>
        <FormSection
          title="Nuevo requerimiento"
          description="La clasificación financiera ocurre al registrar la compra."
        >
          <Field label="Tipo">
            <select
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value === "REFACCION" ? "REFACCION" : "GENERAL")}
              className={controlClass}
            >
              <option value="GENERAL">General</option>
              <option value="REFACCION">Refacción</option>
            </select>
          </Field>
          <Field label="Número de parte" hint={kind === "GENERAL" ? "Opcional para compras generales." : undefined}>
            <input ref={partNumberRef} name="partNumber" required={kind === "REFACCION"} className={controlClass} />
          </Field>
          <Field label="Descripción">
            <input name="description" className={controlClass} />
          </Field>
          <Field label="Cantidad">
            <input name="quantity" type="number" min="1" defaultValue="1" required className={controlClass} />
          </Field>
        </FormSection>
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
            {pending ? "Guardando…" : "Guardar requerimiento"}
          </Button>
        </FormActions>
      </form>
    </FormOverlayDialog>
  );
}
