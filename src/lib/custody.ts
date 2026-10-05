export const CUSTODY = [
  "SIN_CUSTODIA",
  "PENDIENTE_INGRESO",
  "EN_RESGUARDO",
  "FUERA_A_PRUEBA",
  "EN_PROVEEDOR",
  "FUERA",
] as const;

export type Custody = (typeof CUSTODY)[number];

export const MOVEMENTS = [
  "ENTRADA",
  "INGRESO",
  "SALIDA_PRUEBA",
  "RETORNO",
  "SALIDA_PROVEEDOR",
  "RETORNO_PROVEEDOR",
  "SALIDA",
  "EGRESO",
] as const;

export type MovementKind = (typeof MOVEMENTS)[number];

export const CUSTODY_LABEL: Record<Custody, string> = {
  SIN_CUSTODIA: "Sin custodia",
  PENDIENTE_INGRESO: "Pendiente de ingreso",
  EN_RESGUARDO: "En resguardo",
  FUERA_A_PRUEBA: "Fuera a prueba",
  EN_PROVEEDOR: "Con proveedor",
  FUERA: "Fuera",
};

export const MOVEMENT_REASONS: Record<MovementKind, readonly string[]> = {
  ENTRADA: ["Diagnóstico", "Reparación", "Diagnóstico de Garantía", "Venta de equipo", "Retorno de proveedor"],
  INGRESO: ["Diagnóstico", "Reparación", "Diagnóstico de Garantía", "Venta de equipo", "Retorno de proveedor"],
  SALIDA_PRUEBA: ["Salida a prueba"],
  RETORNO: ["Salida a prueba"],
  SALIDA_PROVEEDOR: ["Diagnóstico", "Reparación", "Diagnóstico de Garantía"],
  RETORNO_PROVEEDOR: ["Retorno de proveedor"],
  SALIDA: ["Diagnóstico", "Reparación", "Diagnóstico de Garantía", "Venta de equipo", "Salida a prueba"],
  EGRESO: ["Diagnóstico", "Reparación", "Diagnóstico de Garantía", "Venta de equipo", "Salida a prueba"],
};

export function reasonsFor(movement: MovementKind): readonly string[] {
  return MOVEMENT_REASONS[movement];
}

export const MOVEMENT_LABEL: Record<MovementKind, string> = {
  ENTRADA: "Entrada",
  INGRESO: "Ingreso",
  SALIDA_PRUEBA: "Salida a prueba",
  RETORNO: "Retorno de prueba",
  SALIDA_PROVEEDOR: "Salida a proveedor",
  RETORNO_PROVEEDOR: "Retorno de proveedor",
  SALIDA: "Salida",
  EGRESO: "Egreso",
};

const NEXT: Record<string, Partial<Record<MovementKind, Custody>>> = {
  "EQUI:SIN_CUSTODIA": { ENTRADA: "EN_RESGUARDO" },
  "EQUI:FUERA": { ENTRADA: "EN_RESGUARDO" },
  "EQUI:EN_RESGUARDO": { SALIDA_PRUEBA: "FUERA_A_PRUEBA", SALIDA_PROVEEDOR: "EN_PROVEEDOR", SALIDA: "FUERA" },
  "EQUI:FUERA_A_PRUEBA": { RETORNO: "EN_RESGUARDO", SALIDA: "FUERA" },
  "EQUI:EN_PROVEEDOR": { RETORNO_PROVEEDOR: "EN_RESGUARDO" },
  "MOT:PENDIENTE_INGRESO": { INGRESO: "EN_RESGUARDO" },
  "MOT:EN_RESGUARDO": { SALIDA_PRUEBA: "FUERA_A_PRUEBA", SALIDA_PROVEEDOR: "EN_PROVEEDOR", EGRESO: "FUERA" },
  "MOT:FUERA_A_PRUEBA": { RETORNO: "EN_RESGUARDO", EGRESO: "FUERA" },
  "MOT:EN_PROVEEDOR": { RETORNO_PROVEEDOR: "EN_RESGUARDO" },
  "MOT:FUERA": {},
};

export function nextCustody(kind: "EQUI" | "MOT", current: Custody, movement: MovementKind): Custody {
  const next = NEXT[`${kind}:${current}`]?.[movement];
  if (!next) {
    throw new Error(`${MOVEMENT_LABEL[movement]} no aplica cuando el ${kind} está en ${CUSTODY_LABEL[current]}.`);
  }
  return next;
}

export function isReceipt(movement: MovementKind): boolean {
  return movement === "ENTRADA" || movement === "INGRESO";
}

export function allowedMovements(kind: "EQUI" | "MOT", current: Custody): MovementKind[] {
  return MOVEMENTS.filter((movement) => NEXT[`${kind}:${current}`]?.[movement]);
}
