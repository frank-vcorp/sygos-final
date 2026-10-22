"use client";

import { movementAction } from "@/app/(erp)/equipos/actions";
import { Button } from "@/components/ui";

/** Regresa a resguardo un equipo en salida a prueba (movimiento RETORNO). */
export function ReingresoPruebaForm({
  equipmentId,
  kind,
  version,
}: {
  equipmentId: string;
  kind: "EQUI" | "MOT";
  version: number;
}) {
  return (
    <form action={movementAction} className="inline">
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="movement" value="RETORNO" />
      <input type="hidden" name="reason" value="Salida a prueba" />
      <Button type="submit">Reingreso</Button>
    </form>
  );
}
