import { prisma } from "@/lib/db";
import type { Custody } from "@/lib/custody";
import { receiptReasonFromAttention } from "@/lib/custody";

const CLOSED_CASE = new Set(["VALIDADO", "TERMINADA", "SIN_REPARACION"]);

const ENABLING_BILLING_KINDS = ["REMISION", "FACTURA", "FACTURA_INTERCOMPANIA"] as const;

export async function findEnablingBillingDocument(technicalCaseId: string) {
  return prisma.billingDocument.findFirst({
    where: {
      technicalCaseId,
      status: "EMITIDA",
      kind: { in: [...ENABLING_BILLING_KINDS] },
    },
    orderBy: { issuedAt: "desc" },
    select: { id: true, folio: true, kind: true },
  });
}

export function definitiveExitAuthorized(caseRow: {
  exitWithoutDocumentAuthorizedAt: Date | null;
}) {
  return caseRow.exitWithoutDocumentAuthorizedAt != null;
}

export async function loadWarehouseExitContext(input: {
  equipmentId: string;
  equipmentKind: "EQUI" | "MOT";
  custody: Custody;
  companyId: string;
  /** Solo rol Almacén: elige prueba vs definitiva según atención abierta. */
  forAlmacenRole?: boolean;
  openAttentionType?: string | null;
}) {
  const exitMovement: "SALIDA" | "EGRESO" = input.equipmentKind === "MOT" ? "EGRESO" : "SALIDA";
  const osCase = await prisma.technicalCase.findFirst({
    where: { equipmentId: input.equipmentId, kind: "OS", status: "TERMINADA", serviceCompanyId: input.companyId },
    orderBy: { updatedAt: "desc" },
    include: { attention: true },
  });
  const diagnosisCase = await prisma.technicalCase.findFirst({
    where: {
      equipmentId: input.equipmentId,
      kind: "DIAGNOSTICO",
      serviceCompanyId: input.companyId,
      status: { notIn: [...CLOSED_CASE] },
    },
    orderBy: { createdAt: "desc" },
    include: { attention: true },
  });

  let canDefinitiveExit = false;
  let definitiveBlockedMessage: string | null = null;
  let enablingDocumentLabel: string | null = null;
  let technicalCaseId: string | null = null;
  let definitiveReason = "Reparación";

  if (input.custody !== "EN_RESGUARDO") {
    definitiveBlockedMessage = "La salida definitiva aplica con el equipo en resguardo.";
  } else if (!osCase) {
    definitiveBlockedMessage = "No hay una orden de servicio terminada para entregar.";
  } else {
    technicalCaseId = osCase.id;
    const expectedReason = receiptReasonFromAttention(osCase.attention.attentionType);
    definitiveReason = expectedReason ?? "Reparación";
    const billing = await findEnablingBillingDocument(osCase.id);
    if (billing) {
      canDefinitiveExit = true;
      enablingDocumentLabel = `${billing.kind} ${billing.folio}`;
    } else if (definitiveExitAuthorized(osCase)) {
      canDefinitiveExit = true;
      enablingDocumentLabel = "Salida autorizada por CEO (sin documento)";
    } else if (osCase.exitWithoutDocumentRequestedAt) {
      definitiveBlockedMessage = "El vendedor solicitó salida sin documento. Espera la autorización del CEO.";
    } else {
      definitiveBlockedMessage = "Falta remisión o factura emitida, o que ventas solicite autorización al CEO.";
    }
  }

  const sellerUserId = osCase?.attention.sellerUserId ?? diagnosisCase?.attention.sellerUserId ?? null;
  const seller = sellerUserId
    ? await prisma.user.findUnique({ where: { id: sellerUserId }, select: { name: true } })
    : null;

  const canTestExit = input.custody === "EN_RESGUARDO" && Boolean(diagnosisCase);

  let exitKind: "test" | "definitive" | null = null;
  let blockedMessage: string | null = null;

  if (input.forAlmacenRole) {
    const attentionType = input.openAttentionType ?? null;
    if (input.custody !== "EN_RESGUARDO") {
      blockedMessage = "El equipo debe estar en resguardo para registrar la salida.";
    } else if (attentionType === "REPARACION") {
      exitKind = "definitive";
      if (!canDefinitiveExit) blockedMessage = definitiveBlockedMessage ?? "No puedes registrar la salida definitiva todavía.";
    } else if (attentionType === "DIAGNOSTICO" || attentionType === "DIAGNOSTICO_GARANTIA") {
      exitKind = "test";
      if (!canTestExit) blockedMessage = "La salida a prueba solo aplica con un diagnóstico en curso.";
    } else if (attentionType) {
      blockedMessage = "Este tipo de servicio no permite registrar salida desde almacén.";
    } else {
      blockedMessage = "No hay una atención abierta para este equipo.";
    }
  }

  return {
    exitMovement,
    canDefinitiveExit,
    definitiveBlockedMessage,
    enablingDocumentLabel,
    technicalCaseId,
    definitiveReason,
    sellerName: seller?.name ?? "Vendedor asignado",
    canTestExit,
    testReason: "Salida a prueba",
    exitKind,
    blockedMessage,
  };
}

/** Equipo en salida definitiva por OS terminada (motivo reparación). */
export function isOsDefinitiveCustodyExit(movement: { kind: string; reason: string; cancelledAt: Date | null } | undefined) {
  if (!movement || movement.cancelledAt) return false;
  return (movement.kind === "SALIDA" || movement.kind === "EGRESO") && movement.reason === "Reparación";
}

export async function assertDefinitiveWarehouseExit(technicalCaseId: string, equipmentId: string) {
  const row = await prisma.technicalCase.findFirst({
    where: { id: technicalCaseId, equipmentId, kind: "OS", status: "TERMINADA" },
    include: { equipment: true },
  });
  if (!row) throw new Error("La salida definitiva requiere una OS terminada de este equipo.");
  if (row.equipment.custody !== "EN_RESGUARDO") {
    throw new Error("El equipo debe estar en resguardo para registrar la salida.");
  }
  const billing = await findEnablingBillingDocument(row.id);
  if (billing) return { enablingDocument: `${billing.kind} ${billing.folio}` };
  if (definitiveExitAuthorized(row)) return { enablingDocument: "Salida autorizada CEO" };
  throw new Error("No hay documento emitido ni autorización del CEO para esta salida.");
}

export async function assertTestWarehouseExit(equipmentId: string, serviceCompanyId: string) {
  const row = await prisma.technicalCase.findFirst({
    where: {
      equipmentId,
      serviceCompanyId,
      kind: "DIAGNOSTICO",
      status: { notIn: [...CLOSED_CASE] },
    },
    include: { equipment: true },
  });
  if (!row) throw new Error("La salida a prueba solo aplica con un diagnóstico en curso.");
  if (row.equipment.custody !== "EN_RESGUARDO") {
    throw new Error("El equipo debe estar en resguardo.");
  }
}

export async function requestExitWithoutDocument(
  actor: { userId: string; role: string },
  caseId: string,
  version: number,
) {
  const row = await prisma.technicalCase.findUnique({
    where: { id: caseId },
    include: { equipment: true, attention: true },
  });
  if (!row || row.kind !== "OS" || row.status !== "TERMINADA") {
    throw new Error("Solo una OS terminada puede solicitar salida sin documento.");
  }
  if (row.equipment.custody !== "EN_RESGUARDO") {
    throw new Error("El equipo debe seguir en resguardo.");
  }
  const billing = await findEnablingBillingDocument(row.id);
  if (billing) throw new Error("Esta OS ya tiene documento emitido; almacén puede registrar la salida.");
  if (definitiveExitAuthorized(row)) throw new Error("La salida sin documento ya está autorizada.");
  if (row.exitWithoutDocumentRequestedAt && !row.exitWithoutDocumentAuthorizedAt) {
    throw new Error("Ya hay una solicitud pendiente ante el CEO.");
  }
  if (actor.role !== "VENTAS" || row.attention.sellerUserId !== actor.userId) {
    throw new Error("Solo el vendedor asignado puede solicitar esta salida.");
  }
  const updated = await prisma.technicalCase.updateMany({
    where: { id: caseId, version },
    data: {
      exitWithoutDocumentRequestedAt: new Date(),
      exitWithoutDocumentRequestedByUserId: actor.userId,
      exitWithoutDocumentAuthorizedAt: null,
      exitWithoutDocumentAuthorizedByUserId: null,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new Error("La operación cambió; recarga e intenta de nuevo.");
}

export async function authorizeExitWithoutDocument(actor: { userId: string; role: string }, caseId: string, version: number) {
  if (actor.role !== "CEO" && actor.role !== "ADMINISTRADOR") {
    throw new Error("Solo el CEO puede autorizar salidas sin documento.");
  }
  const row = await prisma.technicalCase.findUnique({ where: { id: caseId } });
  if (!row?.exitWithoutDocumentRequestedAt) {
    throw new Error("No hay solicitud pendiente para esta OS.");
  }
  if (row.exitWithoutDocumentAuthorizedAt) throw new Error("Esta salida ya fue autorizada.");
  const updated = await prisma.technicalCase.updateMany({
    where: { id: caseId, version },
    data: {
      exitWithoutDocumentAuthorizedAt: new Date(),
      exitWithoutDocumentAuthorizedByUserId: actor.userId,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new Error("La operación cambió; recarga e intenta de nuevo.");
}
