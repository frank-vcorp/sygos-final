"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  movementModalAction,
  proofModalAction,
  transferModalAction,
  type FinanzasModalState,
} from "./actions";
import {
  ManualMovementFormActions,
  ManualMovementFormFields,
  movementTriggerLabel,
  type ManualMovementDirectionMode,
} from "./manual-movement-form";
import { FormOverlayDialog } from "@/components/overlay-dialog";
import type { ExpenseCategoryCatalogItem } from "@/lib/expense-catalog";
import { Button, controlClass, Field, FormActions, FormSection, MoneyInput } from "@/components/ui";

const initialState: FinanzasModalState = { status: "idle" };

type Account = { id: string; name: string; kind: string };
type IncomeCategory = { id: string; name: string };
type Bank = { id: string; name: string };

export function ManualMovementDialog({
  accounts,
  expenseCategories,
  incomeCategories,
  directionMode = "both",
  triggerLabel,
  className = "",
}: {
  accounts: Account[];
  expenseCategories: ExpenseCategoryCatalogItem[];
  incomeCategories: IncomeCategory[];
  directionMode?: ManualMovementDirectionMode;
  triggerLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const label = triggerLabel ?? movementTriggerLabel(directionMode);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.querySelector("button")?.focus());
  }

  return (
    <div className={className} ref={triggerRef}>
      <Button type="button" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open ? (
        <ManualMovementDialogPanel
          onClose={close}
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          directionMode={directionMode}
        />
      ) : null}
    </div>
  );
}

function ManualMovementDialogPanel({
  onClose,
  accounts,
  expenseCategories,
  incomeCategories,
  directionMode,
}: {
  onClose: () => void;
  accounts: Account[];
  expenseCategories: ExpenseCategoryCatalogItem[];
  incomeCategories: IncomeCategory[];
  directionMode: ManualMovementDirectionMode;
}) {
  const [state, formAction, pending] = useActionState(movementModalAction, initialState);
  const router = useRouter();
  const dialogTitle =
    directionMode === "ingreso" ? "Ingreso manual"
      : directionMode === "egreso" ? "Egreso manual"
        : "Movimiento manual";

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <FormOverlayDialog open onClose={onClose} title={dialogTitle} titleId="finanzas-movement-dialog" wide>
      <form action={formAction} className="max-w-none">
        <ManualMovementFormFields
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          directionMode={directionMode}
        />
        {state.status === "error" ? (
          <p className="px-5 pt-4 text-sm text-[var(--danger)]" role="alert">
            {state.message}
          </p>
        ) : null}
        <ManualMovementFormActions pending={pending} onCancel={onClose} />
      </form>
    </FormOverlayDialog>
  );
}

export function FinanzasTransferDialog({
  banks,
  className = "",
  variant = "button",
}: {
  banks: Bank[];
  className?: string;
  variant?: "button" | "card";
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.querySelector("button")?.focus());
  }

  if (banks.length === 0) {
    return variant === "card" ? (
      <p className="text-sm text-[var(--muted)]">Agrega al menos una cuenta de tipo banco para transferir.</p>
    ) : null;
  }

  return (
    <div className={className} ref={triggerRef}>
      {variant === "card" ? (
        <div className="rounded-xl border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Transferencia entre bancos</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Mueve saldo entre cuentas de tipo banco.</p>
          <Button type="button" className="mt-3" onClick={() => setOpen(true)}>
            Transferir
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={() => setOpen(true)}>
          Transferir
        </Button>
      )}
      {open ? <FinanzasTransferDialogPanel banks={banks} onClose={close} /> : null}
    </div>
  );
}

function FinanzasTransferDialogPanel({ banks, onClose }: { banks: Bank[]; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(transferModalAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <FormOverlayDialog open onClose={onClose} title="Transferencia entre bancos" titleId="finanzas-transfer-dialog" wide>
      <form action={formAction} className="max-w-none">
        <FormSection title="Transferencia" description="Mueve saldo entre cuentas de tipo banco. No es ingreso ni gasto.">
          <Field label="Desde">
            <select name="fromId" className={controlClass}>{banks.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          </Field>
          <Field label="Hacia">
            <select name="toId" className={controlClass}>{banks.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          </Field>
          <Field label="Importe"><MoneyInput name="amount" min="0.01" required /></Field>
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
            {pending ? "Guardando…" : "Transferir"}
          </Button>
        </FormActions>
      </form>
    </FormOverlayDialog>
  );
}

export function FinanzasProofDialog({
  movementId,
  summaryTitle,
  description,
}: {
  movementId: string;
  summaryTitle: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.querySelector("button")?.focus());
  }

  return (
    <div ref={triggerRef}>
      <Button type="button" tone="ghost" onClick={() => setOpen(true)}>
        Relacionar comprobante
      </Button>
      {open ? (
        <FinanzasProofDialogPanel
          movementId={movementId}
          summaryTitle={summaryTitle}
          description={description}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

function FinanzasProofDialogPanel({
  movementId,
  summaryTitle,
  description,
  onClose,
}: {
  movementId: string;
  summaryTitle: string;
  description?: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(proofModalAction, initialState);
  const router = useRouter();
  const proofRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    proofRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.status !== "success") return;
    onClose();
    router.refresh();
  }, [onClose, router, state.status]);

  return (
    <FormOverlayDialog open onClose={onClose} title="Relacionar comprobante" titleId="finanzas-proof-dialog">
      <form action={formAction}>
        <input type="hidden" name="movementId" value={movementId} />
        <FormSection title={summaryTitle} description={description} columns={1}>
          <Field label="Factura o comprobante">
            <input ref={proofRef} name="proofNote" required placeholder="Referencia del comprobante" className={controlClass} />
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
          <Button type="submit" tone="ghost" disabled={pending}>
            {pending ? "Guardando…" : "Relacionar"}
          </Button>
        </FormActions>
      </form>
    </FormOverlayDialog>
  );
}
