"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createRequirementAction, type CreateRequirementState } from "../actions";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Badge, Button, controlClass, Field, FormActions, FormSection, recordLinkClass } from "@/components/ui";

const partidaRowClass = "grid gap-3 sm:grid-cols-[minmax(0,1fr)_4.5rem] sm:items-end";

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
  const descriptionRef = useRef<HTMLInputElement>(null);
  const partNumberRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"GENERAL" | "REFACCION">(defaultKind);

  useEffect(() => {
    if (kind === "REFACCION") partNumberRef.current?.focus();
    else descriptionRef.current?.focus();
  }, [kind]);

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
          columns={1}
          title="Partida"
          description={
            shoppingListId
              ? "Se creará y quedará en esta lista de compras."
              : "La clasificación financiera ocurre al registrar la compra."
          }
        >
          {lockKind ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo</span>
              <Badge tone={kind === "REFACCION" ? "warn" : "neutral"}>{kind === "REFACCION" ? "Refacción" : "General"}</Badge>
            </div>
          ) : (
            <Field label="Tipo" className="max-w-[12rem]">
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
          {kind === "REFACCION" ? (
            <Field label="Número de parte">
              <input ref={partNumberRef} name="partNumber" required className={controlClass} />
            </Field>
          ) : null}
          <div className={partidaRowClass}>
            <Field label="Descripción">
              <input
                ref={descriptionRef}
                name="description"
                required={kind === "GENERAL"}
                className={controlClass}
                placeholder={kind === "GENERAL" ? "Qué se necesita comprar" : undefined}
              />
            </Field>
            <Field label="Cantidad">
              <input name="quantity" type="number" min="1" defaultValue="1" required className={controlClass} />
            </Field>
          </div>
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
