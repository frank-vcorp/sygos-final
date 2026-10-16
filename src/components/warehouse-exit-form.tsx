"use client";

import { useState } from "react";
import { movementAction } from "@/app/(erp)/equipos/actions";
import { MovementForm } from "@/components/custody-forms";
import { Button, controlClass, Field } from "@/components/ui";
import type { Custody, MovementKind } from "@/lib/custody";

type ReceiverMode = "vendedor" | "paqueteria";

export function WarehouseExitForm({
  equipmentId,
  equipmentFolio,
  kind,
  version,
  exitMovement,
  definitiveReason,
  sellerName,
  canDefinitiveExit,
  definitiveBlockedMessage,
  technicalCaseId,
  enablingDocumentLabel,
  canTestExit,
  testReason,
  showSupplierExit,
  suppliers,
  allowQuickSupplier,
}: {
  equipmentId: string;
  equipmentFolio: string;
  kind: "EQUI" | "MOT";
  version: number;
  exitMovement: "SALIDA" | "EGRESO";
  definitiveReason: string;
  sellerName: string;
  canDefinitiveExit: boolean;
  definitiveBlockedMessage: string | null;
  technicalCaseId: string | null;
  enablingDocumentLabel: string | null;
  canTestExit: boolean;
  testReason: string;
  showSupplierExit: boolean;
  suppliers: Array<{ id: string; name: string }>;
  allowQuickSupplier: boolean;
}) {
  const [mode, setMode] = useState<"definitive" | "test">(canTestExit && !canDefinitiveExit ? "test" : "definitive");
  const [receiverMode, setReceiverMode] = useState<ReceiverMode>("vendedor");

  const receiverName = receiverMode === "vendedor" ? sellerName : "Paquetería";
  const deliveryMode = receiverMode === "vendedor" ? "Vendedor asignado" : "Paquetería";

  return (
    <div className="grid gap-4">
      <p className="text-sm text-[var(--muted)]">
        Equipo <span className="font-medium text-[var(--ink)]">{equipmentFolio}</span>. La entrada ya quedó registrada; aquí solo registras salidas.
      </p>
      <div className="flex flex-wrap gap-2">
        {canDefinitiveExit || definitiveBlockedMessage ? (
          <Button type="button" tone={mode === "definitive" ? "primary" : "ghost"} onClick={() => setMode("definitive")}>
            Salida definitiva
          </Button>
        ) : null}
        {canTestExit ? (
          <Button type="button" tone={mode === "test" ? "primary" : "ghost"} onClick={() => setMode("test")}>
            Salida a pruebas
          </Button>
        ) : null}
      </div>

      {mode === "definitive" ? (
        canDefinitiveExit && technicalCaseId && enablingDocumentLabel ? (
          <form action={movementAction} className="grid gap-3">
            <input type="hidden" name="equipmentId" value={equipmentId} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="movement" value={exitMovement} />
            <input type="hidden" name="reason" value={definitiveReason} />
            <input type="hidden" name="technicalCaseId" value={technicalCaseId} />
            <input type="hidden" name="enablingDocument" value={enablingDocumentLabel} />
            <input type="hidden" name="receiverName" value={receiverName} />
            <input type="hidden" name="deliveryMode" value={deliveryMode} />
            <p className="text-sm text-[var(--muted)]">Documento: {enablingDocumentLabel}</p>
            <Field label="Entrega a">
              <select
                className={controlClass}
                value={receiverMode}
                onChange={(event) => setReceiverMode(event.target.value as ReceiverMode)}
              >
                <option value="vendedor">{sellerName} (vendedor asignado)</option>
                <option value="paqueteria">Paquetería</option>
              </select>
            </Field>
            <Field label="Fecha y hora"><input name="occurredAt" type="datetime-local" className={controlClass} /></Field>
            <Field label="Observaciones"><textarea name="notes" rows={2} className={controlClass} /></Field>
            <Button type="submit">Confirmar salida definitiva</Button>
          </form>
        ) : (
          <p className="rounded-md border border-[#efd0d0] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            {definitiveBlockedMessage ?? "No puedes registrar la salida definitiva todavía."}
          </p>
        )
      ) : null}

      {mode === "test" && canTestExit ? (
        <form action={movementAction} className="grid gap-3">
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="movement" value="SALIDA_PRUEBA" />
          <input type="hidden" name="reason" value={testReason} />
          <input type="hidden" name="receiverName" value={sellerName} />
          <p className="text-sm text-[var(--muted)]">Solo aplica mientras el diagnóstico está en curso. Recibe: {sellerName}.</p>
          <Field label="Fecha y hora"><input name="occurredAt" type="datetime-local" className={controlClass} /></Field>
          <Field label="Observaciones"><textarea name="notes" rows={2} className={controlClass} /></Field>
          <Button type="submit">Confirmar salida a pruebas</Button>
        </form>
      ) : null}

      {showSupplierExit ? (
        <details className="rounded-lg border border-[var(--line)] p-3">
          <summary className="cursor-pointer text-sm font-medium">Salida a proveedor externo</summary>
          <div className="mt-3">
            <MovementForm
              variant="plain"
              equipmentId={equipmentId}
              equipmentFolio={equipmentFolio}
              kind={kind}
              custody="EN_RESGUARDO"
              version={version}
              suppliers={suppliers}
              allowQuickSupplier={allowQuickSupplier}
              restrictMovements={["SALIDA_PROVEEDOR"]}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
