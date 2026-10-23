"use client";

import { movementAction } from "@/app/(erp)/equipos/actions";
import { ClientNameLink } from "@/components/client-entity-links";
import { Button } from "@/components/ui";
import { MOVEMENT_LABEL, type MovementKind } from "@/lib/custody";

export function PassToResguardoForm({
  equipmentId,
  equipmentFolio,
  kind,
  version,
  movement,
  reason,
  serviceLabel,
  reportedFault,
  clientId,
  clientName,
  clientIsSystem = false,
  direct = false,
}: {
  equipmentId: string;
  equipmentFolio: string;
  kind: "EQUI" | "MOT";
  version: number;
  movement: MovementKind;
  reason: string;
  serviceLabel: string;
  reportedFault: string;
  clientId: string;
  clientName: string;
  clientIsSystem?: boolean;
  /** Un solo clic desde la cabecera del equipo (sin overlay ni resumen). */
  direct?: boolean;
}) {
  const fields = (
    <>
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="movement" value={movement} />
      <input type="hidden" name="reason" value={reason} />
    </>
  );

  if (direct) {
    return (
      <form action={movementAction} className="inline">
        {fields}
        <Button type="submit">Pasar a resguardo</Button>
      </form>
    );
  }

  return (
    <form action={movementAction} className="grid gap-4">
      {fields}
      <p className="text-sm text-[var(--muted)]">
        El servicio ya lo definió ventas. Al pasar a resguardo se inicia el SLA y el folio DX u OS.
      </p>
      <dl className="grid gap-2 rounded-md border border-[var(--line)] bg-[#f7f8f9] p-3 text-sm">
        <div><dt className="text-[var(--muted)]">Equipo</dt><dd className="font-medium">{equipmentFolio}</dd></div>
        <div>
          <dt className="text-[var(--muted)]">Cliente</dt>
          <dd><ClientNameLink clientId={clientId} name={clientName} isSystem={clientIsSystem} /></dd>
        </div>
        <div><dt className="text-[var(--muted)]">Servicio</dt><dd>{serviceLabel}</dd></div>
        <div><dt className="text-[var(--muted)]">Falla reportada</dt><dd>{reportedFault}</dd></div>
        <div><dt className="text-[var(--muted)]">Movimiento</dt><dd>{MOVEMENT_LABEL[movement]}</dd></div>
      </dl>
      <Button type="submit">Pasar a resguardo</Button>
    </form>
  );
}
