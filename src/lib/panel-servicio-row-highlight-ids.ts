import { servicioRowHighlight, type SupervisorServicioRow } from "@/lib/servicios-supervisor-rows";

/** Debe coincidir con `rowKey` en `ServiciosSupervisorList`. */
export function supervisorServicioRowStableId(row: SupervisorServicioRow): string {
  return row.kind === "cancelado" ? `att-${row.id}` : row.id;
}

export function cobranzaVigenteRowIds(
  rows: readonly SupervisorServicioRow[],
  vigenteEquipmentIds: ReadonlySet<string>,
): string[] {
  return rows
    .filter((row) => row.kind === "servicio" && vigenteEquipmentIds.has(row.equipmentId))
    .map(supervisorServicioRowStableId);
}

export function vencidoServicioRowIds(rows: readonly SupervisorServicioRow[], now: number | Date): string[] {
  const nowMs = typeof now === "number" ? now : now.getTime();
  return rows
    .filter((row) => servicioRowHighlight(row, nowMs).markers.includes("Vencido"))
    .map(supervisorServicioRowStableId);
}