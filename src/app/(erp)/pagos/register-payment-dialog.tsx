"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  intercompanyPaymentModalAction,
  registerPaymentModalAction,
  type PaymentModalState,
} from "./actions";
import type { PaymentPayableOption, PaymentReceivableOption } from "./payment-form-data";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import { Button, controlClass, Field, FormActions, FormSection, MoneyInput } from "@/components/ui";
import { money } from "@/lib/money";

const initialState: PaymentModalState = { status: "idle" };

function receivableLabel(row: PaymentReceivableOption) {
  const client = row.clientIsSystem ? "SYSTRON" : row.clientName;
  return `${row.documentFolio} · ${client} · saldo ${money(row.balance)}`;
}

export function RegisterPaymentFormFields({
  receivables,
  defaultReceivableId = "",
}: {
  receivables: PaymentReceivableOption[];
  defaultReceivableId?: string;
}) {
  const selectedDefault =
    defaultReceivableId && receivables.some((row) => row.id === defaultReceivableId) ? defaultReceivableId : "";

  return (
    <FormSection
      title="Aplicación del pago"
      description="Selecciona el documento y captura la evidencia del movimiento."
    >
      <div className="md:col-span-2">
        <Field label="Cuenta por cobrar">
          <select name="receivableId" required className={controlClass} defaultValue={selectedDefault}>
            <option value="">Selecciona</option>
            {receivables.map((row) => (
              <option key={row.id} value={row.id}>
                {receivableLabel(row)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Importe">
        <MoneyInput name="amount" required min="0.01" />
      </Field>
      <Field label="Forma">
        <select name="method" className={controlClass} defaultValue="TRANSFERENCIA">
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="EFECTIVO">Efectivo</option>
        </select>
      </Field>
      <Field label="Comprobante">
        <input name="receipt" required className={controlClass} />
      </Field>
      <Field label="Destino">
        <input name="destination" required className={controlClass} placeholder="Cuenta o caja" />
      </Field>
    </FormSection>
  );
}

function IntercompanyPaymentFormFields({ payables }: { payables: PaymentPayableOption[] }) {
  return (
    <FormSection
      title="Pago a Servomotores"
      description="Sale de una cuenta de SYSTRON. Servomotores confirma la entrada y puede ser parcial."
    >
      <div className="md:col-span-2">
        <Field label="Cuenta por pagar">
          <select name="payableId" required className={controlClass} defaultValue={payables[0]?.id ?? ""}>
            {payables.map((row) => (
              <option key={row.id} value={row.id}>
                {row.documentFolio ?? "Compra"} · saldo {money(row.balance)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Importe">
        <MoneyInput name="amount" required min="0.01" />
      </Field>
      <Field label="Comprobante">
        <input name="receipt" required className={controlClass} />
      </Field>
      <Field label="Cuenta de origen">
        <input name="destination" required className={controlClass} />
      </Field>
    </FormSection>
  );
}

type TriggerVariant = "primary" | "ghost" | "text";

function RegisterPaymentTrigger({
  variant,
  onClick,
  children,
}: {
  variant: TriggerVariant;
  onClick: () => void;
  children: React.ReactNode;
}) {
  if (variant === "text") {
    return (
      <button type="button" onClick={onClick} className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">
        {children}
      </button>
    );
  }
  return (
    <Button type="button" tone={variant === "ghost" ? "ghost" : undefined} onClick={onClick}>
      {children}
    </Button>
  );
}

export function RegisterPaymentDialog({
  receivables,
  payables,
  defaultReceivableId,
  triggerLabel = "Registrar pago",
  triggerVariant = "primary",
  className = "",
  initiallyOpen = false,
  showTrigger = true,
  returnHref,
}: {
  receivables: PaymentReceivableOption[];
  payables: PaymentPayableOption[];
  defaultReceivableId?: string;
  triggerLabel?: string;
  triggerVariant?: TriggerVariant;
  className?: string;
  initiallyOpen?: boolean;
  showTrigger?: boolean;
  returnHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const triggerRef = useRef<HTMLDivElement>(null);
  const showIntercompany = payables.length > 0;

  function close() {
    setOpen(false);
    if (returnHref) router.replace(returnHref);
    requestAnimationFrame(() => triggerRef.current?.querySelector("button")?.focus());
  }

  return (
    <div className={className} ref={triggerRef}>
      {showTrigger ? (
        <RegisterPaymentTrigger variant={triggerVariant} onClick={() => setOpen(true)}>
          {triggerLabel}
        </RegisterPaymentTrigger>
      ) : null}
      {open ? (
        <RegisterPaymentDialogPanel
          receivables={receivables}
          payables={payables}
          defaultReceivableId={defaultReceivableId}
          showIntercompany={showIntercompany}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function RegisterPaymentDialogPanel({
  receivables,
  payables,
  defaultReceivableId,
  showIntercompany,
  onClose,
}: {
  receivables: PaymentReceivableOption[];
  payables: PaymentPayableOption[];
  defaultReceivableId?: string;
  showIntercompany: boolean;
  onClose: () => void;
}) {
  const [section, setSection] = useState<"cliente" | "intercompania">("cliente");

  return (
    <FormOverlayDialog
      open
      onClose={onClose}
      title="Registrar pago"
      titleId="register-payment-dialog"
      wide
    >
      <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
        El vendedor lo deja pendiente. Coordinación, CEO o Administrador pueden dejarlo validado.
      </p>
      {showIntercompany ? (
        <div className="mb-4 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3">
          <Button type="button" tone={section === "cliente" ? undefined : "ghost"} onClick={() => setSection("cliente")}>
            Pago de cliente
          </Button>
          <Button
            type="button"
            tone={section === "intercompania" ? undefined : "ghost"}
            onClick={() => setSection("intercompania")}
          >
            Pago a Servomotores
          </Button>
        </div>
      ) : null}
      {section === "cliente" || !showIntercompany ? (
        <ClientPaymentDialogForm receivables={receivables} defaultReceivableId={defaultReceivableId} onClose={onClose} />
      ) : (
        <IntercompanyPaymentDialogForm payables={payables} onClose={onClose} />
      )}
    </FormOverlayDialog>
  );
}

function ClientPaymentDialogForm({
  receivables,
  defaultReceivableId,
  onClose,
}: {
  receivables: PaymentReceivableOption[];
  defaultReceivableId?: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(registerPaymentModalAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <form action={formAction} className="max-w-none">
      <RegisterPaymentFormFields receivables={receivables} defaultReceivableId={defaultReceivableId} />
      {state.status === "error" ? (
        <p className="px-5 pt-4 text-sm text-[var(--danger)]" role="alert">
          {state.message}
        </p>
      ) : null}
      <FormActions note="El estado final depende de los permisos del perfil que registra.">
        <Button type="button" tone="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar pago"}
        </Button>
      </FormActions>
    </form>
  );
}

function IntercompanyPaymentDialogForm({
  payables,
  onClose,
}: {
  payables: PaymentPayableOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(intercompanyPaymentModalAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <form action={formAction} className="max-w-none">
      <IntercompanyPaymentFormFields payables={payables} />
      {state.status === "error" ? (
        <p className="px-5 pt-4 text-sm text-[var(--danger)]" role="alert">
          {state.message}
        </p>
      ) : null}
      <FormActions>
        <Button type="button" tone="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" tone="ghost" disabled={pending}>
          {pending ? "Guardando…" : "Registrar salida"}
        </Button>
      </FormActions>
    </form>
  );
}
