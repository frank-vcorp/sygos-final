"use client";

import { useState } from "react";
import { movementAction } from "@/app/(erp)/equipos/actions";
import { Button, controlClass, Field } from "@/components/ui";

type ReceiverMode = "vendedor" | "paqueteria";

/** Salida en almacén: un solo botón según DX (prueba) u OS (definitiva). */
export function WarehouseExitFormAlmacen({
  equipmentId,
  equipmentFolio,
  kind,
  version,
  exitMovement,
  definitiveReason,
  sellerName,
  technicalCaseId,
  enablingDocumentLabel,
  exitKind,
  blockedMessage,
  testReason,
  direct = false,
}: {
  equipmentId: string;
  equipmentFolio: string;
  kind: "EQUI" | "MOT";
  version: number;
  exitMovement: "SALIDA" | "EGRESO";
  definitiveReason: string;
  sellerName: string;
  technicalCaseId: string | null;
  enablingDocumentLabel: string | null;
  exitKind: "test" | "definitive" | null;
  blockedMessage: string | null;
  testReason: string;
  /** Cabecera del equipo: un clic, sin overlay; redirige al documento de salida. */
  direct?: boolean;
}) {
  const [receiverMode, setReceiverMode] = useState<ReceiverMode>("vendedor");
  const receiverName = receiverMode === "vendedor" ? sellerName : "Paquetería";
  const deliveryMode = receiverMode === "vendedor" ? "Vendedor asignado" : "Paquetería";

  if (blockedMessage || !exitKind) {
    const needsBillingHint =
      blockedMessage?.includes("documento")
      || blockedMessage?.includes("remisión")
      || blockedMessage?.includes("factura")
      || blockedMessage?.includes("CEO")
      || blockedMessage?.includes("orden de servicio");
    return (
      <div className="grid gap-2 rounded-md border border-[#efd0d0] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
        <p>{blockedMessage ?? "No puedes registrar la salida todavía."}</p>
        {needsBillingHint && !direct ? (
          <p className="text-[var(--ink)]">
            Salida definitiva: requiere <strong>remisión o factura</strong> de la OS terminada. Sin documento, <strong>ventas</strong> debe pedir autorización al <strong>CEO</strong> y almacén espera la aprobación.
          </p>
        ) : null}
      </div>
    );
  }

  if (exitKind === "test") {
    const fields = (
      <>
        <input type="hidden" name="equipmentId" value={equipmentId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="movement" value="SALIDA_PRUEBA" />
        <input type="hidden" name="reason" value={testReason} />
        <input type="hidden" name="receiverName" value={sellerName} />
      </>
    );
    if (direct) {
      return (
        <form action={movementAction} className="inline">
          {fields}
          <Button type="submit">Registrar salida</Button>
        </form>
      );
    }
    return (
      <form action={movementAction} className="grid gap-3">
        {fields}
        <p className="text-sm text-[var(--muted)]">
          Equipo <span className="font-medium text-[var(--ink)]">{equipmentFolio}</span>. Mientras el DX sigue abierto (sin validar), la salida será a prueba. Recibe: {sellerName}.
        </p>
        <Field label="Fecha y hora"><input name="occurredAt" type="datetime-local" className={controlClass} /></Field>
        <Field label="Observaciones"><textarea name="notes" rows={2} className={controlClass} /></Field>
        <Button type="submit">Registrar salida</Button>
      </form>
    );
  }

  if (exitKind === "definitive" && technicalCaseId && enablingDocumentLabel) {
    const fields = (
      <>
        <input type="hidden" name="equipmentId" value={equipmentId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="movement" value={exitMovement} />
        <input type="hidden" name="reason" value={definitiveReason} />
        <input type="hidden" name="technicalCaseId" value={technicalCaseId} />
        <input type="hidden" name="enablingDocument" value={enablingDocumentLabel} />
        <input type="hidden" name="receiverName" value={direct ? sellerName : receiverName} />
        <input type="hidden" name="deliveryMode" value={direct ? "Vendedor asignado" : deliveryMode} />
      </>
    );
    if (direct) {
      return (
        <form action={movementAction} className="inline">
          {fields}
          <Button type="submit">Registrar salida</Button>
        </form>
      );
    }
    return (
      <form action={movementAction} className="grid gap-3">
        {fields}
        <p className="text-sm text-[var(--muted)]">
          Equipo <span className="font-medium text-[var(--ink)]">{equipmentFolio}</span>. Con OS terminada, la salida será definitiva.
        </p>
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
        <Button type="submit">Registrar salida</Button>
      </form>
    );
  }

  return null;
}
