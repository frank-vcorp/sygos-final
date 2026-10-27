"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createRequirementAction, type CreateRequirementState } from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass, Field, FormActions, FormSection, recordLinkClass } from "@/components/ui";

const initialState: CreateRequirementState = { status: "idle" };

export function RequirementCreateModal({
  defaultKind = "GENERAL",
  lockKind = false,
  shoppingListId,
  triggerLabel = "Nuevo requerimiento",
  triggerVariant = "button",
  initiallyOpen = false,
  showTrigger = true,
  returnHref = "/compras/requerimientos",
}: {
  defaultKind?: "GENERAL" | "REFACCION";
  lockKind?: boolean;
  shoppingListId?: string;
  triggerLabel?: string;
  triggerVariant?: "button" | "record";
  initiallyOpen?: boolean;
  showTrigger?: boolean;
  returnHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const triggerRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    if (initiallyOpen) router.replace(returnHref);
    requestAnimationFrame(() => triggerRef.current?.querySelector("button")?.focus());
  };

  return (
    <>
      {showTrigger ? (
        <div ref={triggerRef}>
          {triggerVariant === "record" ? (
            <button type="button" className={recordLinkClass} onClick={() => setOpen(true)}>
              {triggerLabel}
            </button>
          ) : (
            <Button type="button" onClick={() => setOpen(true)}>
              {triggerLabel}
            </Button>
          )}
        </div>
      ) : null}
      {open ? (
        <RequirementCreateDialog
          onClose={close}
          defaultKind={defaultKind}
          lockKind={lockKind}
          shoppingListId={shoppingListId}
        />
      ) : null}
    </>
  );
}

function RequirementCreateDialog({
  onClose,
  defaultKind,
  lockKind,
  shoppingListId,
}: {
  onClose: () => void;
  defaultKind: "GENERAL" | "REFACCION";
  lockKind: boolean;
  shoppingListId?: string;
}) {
  const [state, formAction, pending] = useActionState(createRequirementAction, initialState);
  const router = useRouter();
  const partNumberRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"GENERAL" | "REFACCION">(defaultKind);

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
        {shoppingListId ? <input type="hidden" name="shoppingListId" value={shoppingListId} /> : null}
        {lockKind ? <input type="hidden" name="kind" value={kind} /> : null}
        <FormSection
          title="Nuevo requerimiento"
          description={
            shoppingListId
              ? "Se creará y quedará en esta lista de compras."
              : "La clasificación financiera ocurre al registrar la compra."
          }
        >
          {lockKind ? (
            <Field label="Tipo">
              <p className="text-sm font-medium">{kind === "REFACCION" ? "Refacción" : "General"}</p>
            </Field>
          ) : (
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
          )}
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
