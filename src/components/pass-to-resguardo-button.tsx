"use client";

import { movementAction } from "@/app/(erp)/equipos/actions";
import { Button } from "@/components/ui";
import type { MovementKind } from "@/lib/custody";

export function PassToResguardoButton({
  equipmentId,
  kind,
  version,
  movement,
  reason,
}: {
  equipmentId: string;
  kind: "EQUI" | "MOT";
  version: number;
  movement: MovementKind;
  reason: string;
}) {
  return (
    <form
      action={movementAction}
      className="inline"
      onSubmit={(event) => {
        if (!window.confirm("¿Pasar este equipo a resguardo? Se iniciará el SLA del servicio.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="movement" value={movement} />
      <input type="hidden" name="reason" value={reason} />
      <Button type="submit">Pasar a resguardo</Button>
    </form>
  );
}
