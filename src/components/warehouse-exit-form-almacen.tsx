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
        {needsBillingHint ? (
          <p className="text-[var(--ink)]">
            Salida definitiva: requiere <strong>remisión o factura</strong> de la OS terminada. Sin documento, <strong>ventas</strong> debe pedir autorización al <strong>CEO</strong> y almacén espera la aprobación.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-[var(--muted)]">
        Equipo <span className="font-medium text-[var(--ink)]">{equipmentFolio}</span>.
        {exitKind === "test"
          ? " Con diagnóstico en curso, la salida será a prueba."
          : " Con OS terminada, la salida será definitiva."}
      </p>

      {exitKind === "definitive" && technicalCaseId && enablingDocumentLabel ? (
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
          <Button type="submit">Registrar salida</Button>
        </form>
      ) : null}

      {exitKind === "test" ? (
        <form action={movementAction} className="grid gap-3">
          <input type="hidden" name="equipmentId" value={equipmentId} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="version" value={version} />
          <input type="hidden" name="movement" value="SALIDA_PRUEBA" />
          <input type="hidden" name="reason" value={testReason} />
          <input type="hidden" name="receiverName" value={sellerName} />
          <p className="text-sm text-[var(--muted)]">Recibe: {sellerName}.</p>
          <Field label="Fecha y hora"><input name="occurredAt" type="datetime-local" className={controlClass} /></Field>
          <Field label="Observaciones"><textarea name="notes" rows={2} className={controlClass} /></Field>
          <Button type="submit">Registrar salida</Button>
        </form>
      ) : null}
    </div>
  );
}
