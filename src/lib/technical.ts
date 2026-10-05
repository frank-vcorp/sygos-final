import { prisma } from "./db";
import { allocateFolio } from "./folios";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { addBusinessDays, warrantyDeadline } from "./sla";

type Actor = {
  userId: string;
  role: string;
  activeCompanyId: string;
  activeCompanyCode: string;
};

const DIAGNOSIS_TYPES = new Set(["DIAGNOSTICO", "DIAGNOSTICO_GARANTIA"]);

export const CASE_STATUS_LABEL: Record<string, string> = {
  EN_ESPERA: "En espera",
  EN_DIAGNOSTICO: "En diagnóstico",
  PENDIENTE_VALIDACION: "Pendiente de validación",
  DEVUELTO: "Devuelto a corrección",
  VALIDADO: "Validado",
  EN_REPARACION: "En reparación",
  EN_ESPERA_REFACCIONES: "En espera de refacciones",
  TERMINADA: "Reparación terminada",
  SIN_REPARACION: "Sin reparación",
};

export async function openPendingCases(equipmentId: string, receivedAt: Date) {
  const attentions = await prisma.attention.findMany({
    where: { equipmentId, slaStartedAt: { not: null }, technicalCases: { none: {} } },
  });
  for (const attention of attentions) {
    await openCase(attention.id, receivedAt);
  }
}

export async function openCase(attentionId: string, receivedAt: Date) {
  const attention = await prisma.attention.findUnique({
    where: { id: attentionId },
    include: { technicalCases: true, serviceCompany: true },
  });
  if (!attention || attention.technicalCases.length > 0 || !attention.slaStartedAt) return null;
  const diagnosis = DIAGNOSIS_TYPES.has(attention.attentionType);
  const folio = await allocateFolio(attention.serviceCompanyId, diagnosis ? "DX" : "OS");
  return prisma.technicalCase.create({
    data: {
      folio,
      attentionId: attention.id,
      equipmentId: attention.equipmentId,
      serviceCompanyId: attention.serviceCompanyId,
      kind: diagnosis ? "DIAGNOSTICO" : "OS",
      status: "EN_ESPERA",
      originalCaseId: attention.originalCaseId,
      slaDueAt: addBusinessDays(receivedAt, attention.prioritySlaMaxDays),
    },
  });
}

export async function assertWarrantyOrigin(equipmentId: string, originalCaseId: string) {
  const original = await prisma.technicalCase.findFirst({
    where: { id: originalCaseId, equipmentId, kind: "OS", status: "TERMINADA", paidAt: { not: null } },
  });
  if (!original?.paidAt) throw new Error("La garantía exige una reparación terminada y marcada como pagada.");
  const exit = await prisma.custodyMovement.findFirst({
    where: {
      equipmentId,
      cancelledAt: null,
      kind: { in: ["SALIDA", "EGRESO"] },
      occurredAt: { gte: original.createdAt },
    },
    orderBy: { occurredAt: "desc" },
  });
  if (!exit) throw new Error("La garantía cuenta desde la salida física de esa reparación.");
  if (warrantyDeadline(exit.occurredAt).getTime() < Date.now()) {
    throw new Error("El periodo de garantía de seis meses ya venció.");
  }
  return original;
}

async function loadCase(id: string) {
  const row = await prisma.technicalCase.findUnique({
    where: { id },
    include: { attention: true, serviceCompany: true, equipment: { include: { originCompany: true } } },
  });
  if (!row) throw new Error("No se encontró la operación técnica.");
  return row;
}

function assertServiceCompany(actor: Actor, serviceCompanyId: string) {
  if (actor.activeCompanyId !== serviceCompanyId) {
    throw new Error("SYSTRON consulta esta operación en solo lectura. El estado lo cambia quien ejecuta el servicio.");
  }
}

function canAssign(actor: Actor) {
  return ["ADMINISTRADOR", "CEO", "SUPERVISOR_TECNICO", "GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES"].includes(actor.role);
}

function canExecute(actor: Actor, assigneeUserId: string | null) {
  if (actor.role === "ADMINISTRADOR" || actor.role === "CEO") return true;
  if (actor.role === "GERENTE_OPERATIVO_SERVOMOTORES" && actor.activeCompanyCode === "SERVOMOTORES") return true;
  if (actor.role === "SUPERVISOR_TECNICO") return true;
  if (actor.role === "TECNICO" && assigneeUserId === actor.userId) return true;
  return false;
}

export async function assignCase(actor: Actor, caseId: string, version: number, assigneeUserId: string | null, supplierId: string | null) {
  const row = await loadCase(caseId);
  assertServiceCompany(actor, row.serviceCompanyId);
  if (!canAssign(actor)) throw new Error("No puedes asignar esta operación.");
  if (["VALIDADO", "TERMINADA", "SIN_REPARACION"].includes(row.status)) {
    throw new Error("La operación ya está cerrada técnicamente.");
  }
  let assigneeId = assigneeUserId;
  if (supplierId) {
    if (row.serviceCompany.code !== "SYSTRON") throw new Error("El servicio externo se usa en SYSTRON.");
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId: actor.activeCompanyId, active: true } });
    if (!supplier) throw new Error("Selecciona un proveedor activo de SYSTRON.");
    assigneeId = null;
  } else if (assigneeId) {
    const user = await prisma.user.findFirst({ where: { id: assigneeId, active: true, companyId: row.serviceCompanyId } });
    if (!user) throw new Error("El responsable no pertenece a la empresa que ejecuta.");
    if (user.role === "GERENTE_OPERATIVO_SYSTRON") throw new Error("El Gerente Operativo de SYSTRON no ejecuta el trabajo técnico.");
    const allowed = row.serviceCompany.code === "SERVOMOTORES" ? user.role === "GERENTE_OPERATIVO_SERVOMOTORES" : user.role === "TECNICO" || user.role === "SUPERVISOR_TECNICO";
    if (!allowed) throw new Error("Ese usuario no puede ejecutar la operación.");
    if (actor.role === "TECNICO") throw new Error("El técnico no se autoasigna.");
  }
  const updated = await prisma.technicalCase.updateMany({
    where: { id: row.id, version },
    data: { assigneeUserId: assigneeId, externalSupplierId: supplierId, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "ASIGNACION",
    summary: supplierId ? "Operación enviada a servicio externo." : "Asignación técnica actualizada.",
    authorUserId: actor.userId,
  });
}

export async function startCase(actor: Actor, caseId: string, version: number) {
  const row = await loadCase(caseId);
  assertServiceCompany(actor, row.serviceCompanyId);
  if (!canExecute(actor, row.assigneeUserId) && !(actor.role === "GERENTE_OPERATIVO_SERVOMOTORES")) {
    throw new Error("Solo el responsable asignado inicia el trabajo.");
  }
  if (row.kind === "DIAGNOSTICO" && !row.assigneeUserId && actor.role !== "GERENTE_OPERATIVO_SERVOMOTORES" && actor.role !== "ADMINISTRADOR" && actor.role !== "CEO" && actor.role !== "SUPERVISOR_TECNICO") {
    throw new Error("Asigna un responsable antes de iniciar.");
  }
  const next = row.kind === "DIAGNOSTICO" ? "EN_DIAGNOSTICO" : "EN_REPARACION";
  if (row.status !== "EN_ESPERA" && row.status !== "DEVUELTO") throw new Error("Esta operación no está en espera.");
  const claim = !row.assigneeUserId && (actor.role === "GERENTE_OPERATIVO_SERVOMOTORES" || actor.role === "SUPERVISOR_TECNICO");
  const data = { status: next, version: { increment: 1 }, ...(claim ? { assigneeUserId: actor.userId } : {}) };
  const updated = await prisma.technicalCase.updateMany({ where: { id: row.id, version }, data });
  if (updated.count === 0) throw new ConcurrencyError();
}

export async function addLog(actor: Actor, caseId: string, body: string) {
  const row = await loadCase(caseId);
  assertServiceCompany(actor, row.serviceCompanyId);
  const canLog = canExecute(actor, row.assigneeUserId) || canAssign(actor);
  if (!canLog) throw new Error("No puedes escribir la bitácora de esta operación.");
  if (["VALIDADO", "TERMINADA", "SIN_REPARACION"].includes(row.status)) {
    throw new Error("La bitácora de una operación cerrada no recibe entradas. Una reapertura permite continuar.");
  }
  await prisma.technicalLog.create({ data: { caseId: row.id, body, authorUserId: actor.userId } });
}

export async function finishDiagnosis(actor: Actor, caseId: string, version: number, resultText: string) {
  const row = await loadCase(caseId);
  assertServiceCompany(actor, row.serviceCompanyId);
  if (row.kind !== "DIAGNOSTICO") throw new Error("Esta no es una operación de diagnóstico.");
  if (!canExecute(actor, row.assigneeUserId)) throw new Error("Solo quien ejecuta puede terminar el diagnóstico.");
  if (!["EN_DIAGNOSTICO", "DEVUELTO"].includes(row.status)) throw new Error("El diagnóstico no está en ejecución.");
  const servomotores = row.serviceCompany.code === "SERVOMOTORES";
  const status = servomotores ? "VALIDADO" : "PENDIENTE_VALIDACION";
  const quotePending = servomotores && (row.attention.priorityPrice == null || row.attention.priorityPrice > 0) && row.attention.attentionType !== "DIAGNOSTICO_GARANTIA";
  const updated = await prisma.technicalCase.updateMany({
    where: { id: row.id, version },
    data: {
      status,
      resultText,
      finishedByUserId: actor.userId,
      validatedByUserId: servomotores ? actor.userId : null,
      validatedAt: servomotores ? new Date() : null,
      quotePending,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "CIERRE_TECNICO",
    summary: servomotores ? "Diagnóstico terminado y validado por quien lo ejecutó en Servomotores." : "Diagnóstico terminado. Queda pendiente la validación del Gerente Operativo.",
    authorUserId: actor.userId,
  });
}

export async function validateDiagnosis(actor: Actor, caseId: string, version: number, decision: "VALIDAR" | "DEVOLVER" | "VALIDA" | "NO_PROCEDENTE", reason: string | null) {
  const row = await loadCase(caseId);
  assertServiceCompany(actor, row.serviceCompanyId);
  const manager = actor.role === "GERENTE_OPERATIVO_SYSTRON" || actor.role === "GERENTE_OPERATIVO_SERVOMOTORES" || actor.role === "ADMINISTRADOR" || actor.role === "CEO";
  if (!manager) throw new Error("La validación corresponde al Gerente Operativo.");
  if (row.status !== "PENDIENTE_VALIDACION" && !(row.serviceCompany.code === "SERVOMOTORES" && row.status === "VALIDADO" && row.attention.attentionType === "DIAGNOSTICO_GARANTIA" && !row.warrantyDecision)) {
    throw new Error("El diagnóstico no está pendiente de validación.");
  }
  if (decision === "DEVOLVER") {
    if (!reason) throw new Error("La devolución exige motivo.");
    const updated = await prisma.technicalCase.updateMany({
      where: { id: row.id, version },
      data: { status: "DEVUELTO", returnReason: reason, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await recordHistory({
      companyId: actor.activeCompanyId,
      entityType: "OPERACION",
      entityId: row.id,
      action: "DEVOLUCION",
      summary: `Devuelto a corrección: ${reason}`,
      authorUserId: actor.userId,
    });
    return;
  }
  const warranty = row.attention.attentionType === "DIAGNOSTICO_GARANTIA";
  const warrantyDecision = decision === "VALIDA" || decision === "NO_PROCEDENTE" ? decision : null;
  if (warranty && !warrantyDecision) throw new Error("Indica si la garantía procede.");
  const quotePending = !warranty && (row.attention.priorityPrice == null || row.attention.priorityPrice > 0);
  const updated = await prisma.technicalCase.updateMany({
    where: { id: row.id, version },
    data: {
      status: "VALIDADO",
      warrantyDecision,
      quotePending: warranty ? decision === "NO_PROCEDENTE" : quotePending,
      validatedByUserId: actor.userId,
      validatedAt: new Date(),
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  if (decision === "VALIDA") await spawnWarrantyRepair(row.id, actor.userId);
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "VALIDACION",
    summary: warranty ? `Garantía ${decision === "VALIDA" ? "válida" : "no procedente"}.` : "Diagnóstico validado.",
    authorUserId: actor.userId,
  });
}

async function spawnWarrantyRepair(diagnosisCaseId: string, authorUserId: string) {
  const diagnosis = await prisma.technicalCase.findUnique({
    where: { id: diagnosisCaseId },
    include: { attention: true },
  });
  if (!diagnosis) return;
  const existing = await prisma.technicalCase.findFirst({ where: { spawnedFromId: diagnosis.id, kind: "OS" } });
  if (existing) return;
  const folio = await allocateFolio(diagnosis.serviceCompanyId, "OS");
  const created = await prisma.technicalCase.create({
    data: {
      folio,
      attentionId: diagnosis.attentionId,
      equipmentId: diagnosis.equipmentId,
      serviceCompanyId: diagnosis.serviceCompanyId,
      kind: "OS",
      status: "EN_ESPERA",
      spawnedFromId: diagnosis.id,
      originalCaseId: diagnosis.originalCaseId,
      slaDueAt: diagnosis.slaDueAt,
      quotePending: false,
    },
  });
  await recordHistory({
    companyId: diagnosis.serviceCompanyId,
    entityType: "OPERACION",
    entityId: created.id,
    action: "ALTA",
    summary: `Reparación en garantía ${folio}. No genera un cobro nuevo si se resuelve.`,
    authorUserId,
  });
}

export async function finishRepair(actor: Actor, caseId: string, version: number, outcome: "TERMINADA" | "SIN_REPARACION", resultText: string) {
  const row = await loadCase(caseId);
  assertServiceCompany(actor, row.serviceCompanyId);
  if (row.kind !== "OS") throw new Error("Esta no es una orden de servicio.");
  if (!canExecute(actor, row.assigneeUserId)) throw new Error("Solo quien ejecuta puede cerrar la reparación.");
  if (!["EN_REPARACION", "EN_ESPERA_REFACCIONES"].includes(row.status)) throw new Error("La reparación no está en ejecución.");
  if (row.status === "EN_ESPERA_REFACCIONES" && outcome === "TERMINADA") {
    throw new Error("Hay refacciones pendientes. No se cierra como reparación terminada.");
  }
  const warranty = Boolean(row.spawnedFromId);
  const updated = await prisma.technicalCase.updateMany({
    where: { id: row.id, version },
    data: {
      status: outcome,
      resultText,
      finishedByUserId: actor.userId,
      quotePending: warranty ? false : true,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "CIERRE_TECNICO",
    summary: outcome === "TERMINADA"
      ? "Reparación terminada. El cierre técnico no cierra la administración."
      : "Sin reparación. El cargo queda para la decisión comercial.",
    authorUserId: actor.userId,
  });
}

export async function reopenCase(actor: Actor, caseId: string, version: number, reason: string) {
  const row = await loadCase(caseId);
  assertServiceCompany(actor, row.serviceCompanyId);
  const allowed = ["ADMINISTRADOR", "CEO", "SUPERVISOR_TECNICO", "GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES"].includes(actor.role);
  if (!allowed) throw new Error("No puedes reabrir esta operación.");
  if (!["VALIDADO", "TERMINADA", "SIN_REPARACION"].includes(row.status)) throw new Error("Solo se reabre un cierre técnico.");
  const child = await prisma.technicalCase.findFirst({ where: { spawnedFromId: row.id } });
  if (child) throw new Error("Ya existe una reparación derivada. No se reabre el diagnóstico.");
  const next = row.kind === "DIAGNOSTICO" ? "EN_DIAGNOSTICO" : "EN_REPARACION";
  const updated = await prisma.technicalCase.updateMany({
    where: { id: row.id, version },
    data: { status: next, quotePending: false, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "REAPERTURA",
    summary: `Reapertura técnica: ${reason}`,
    authorUserId: actor.userId,
  });
}

export async function captureExternalDocument(actor: Actor, caseId: string, version: number, document: string) {
  const row = await loadCase(caseId);
  assertServiceCompany(actor, row.serviceCompanyId);
  if (actor.role !== "GERENTE_OPERATIVO_SYSTRON" && actor.role !== "ADMINISTRADOR" && actor.role !== "CEO") {
    throw new Error("El Gerente Operativo captura el documento del proveedor.");
  }
  if (!row.externalSupplierId) throw new Error("Esta operación no está en servicio externo.");
  const updated = await prisma.technicalCase.updateMany({
    where: { id: row.id, version },
    data: { externalDocument: document, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new ConcurrencyError();
}

export async function markRepairPaid(actor: Actor, caseId: string) {
  if (actor.role !== "ADMINISTRADOR" && actor.role !== "CEO") throw new Error("Solo CEO o Administrador marcan la reparación como pagada.");
  const row = await loadCase(caseId);
  if (row.kind !== "OS" || row.status !== "TERMINADA" || row.spawnedFromId) {
    throw new Error("Solo una reparación terminada, que no sea de garantía, inicia un periodo de garantía.");
  }
  await prisma.technicalCase.update({ where: { id: row.id }, data: { paidAt: new Date(), version: { increment: 1 } } });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "PAGO",
    summary: "Reparación marcada como pagada. Desde su salida física corren seis meses de garantía.",
    authorUserId: actor.userId,
  });
}

export async function overrideWarranty(actor: Actor, caseId: string, version: number, decision: "VALIDA" | "COTIZAR", reason: string) {
  if (actor.role !== "ADMINISTRADOR" && actor.role !== "CEO") throw new Error("La decisión comercial de la garantía es de CEO o Administrador.");
  const row = await loadCase(caseId);
  if (row.warrantyDecision !== "NO_PROCEDENTE") throw new Error("Solo una garantía no procedente admite decisión comercial.");
  const child = await prisma.technicalCase.findFirst({ where: { spawnedFromId: row.id } });
  if (child) throw new Error("Ya hay una reparación derivada.");
  const updated = await prisma.technicalCase.updateMany({
    where: { id: row.id, version },
    data: {
      commercialDecision: decision,
      commercialReason: reason,
      quotePending: decision === "COTIZAR",
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) throw new ConcurrencyError();
  if (decision === "VALIDA") await spawnWarrantyRepair(row.id, actor.userId);
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "OPERACION",
    entityId: row.id,
    action: "DECISION_COMERCIAL",
    summary: decision === "VALIDA" ? `Garantía aceptada comercialmente: ${reason}` : `Se enviará a cotización: ${reason}`,
    authorUserId: actor.userId,
  });
}

export async function requestPart(actor: Actor, caseId: string, input: { partNumber: string; description: string; link: string | null; quantity: number }) {
  const row = await loadCase(caseId);
  assertServiceCompany(actor, row.serviceCompanyId);
  if (row.kind !== "OS") throw new Error("Las refacciones se solicitan desde la orden de servicio.");
  if (!canExecute(actor, row.assigneeUserId) && !canAssign(actor)) throw new Error("No puedes solicitar refacciones.");
  if (["TERMINADA", "SIN_REPARACION"].includes(row.status)) throw new Error("La orden ya está cerrada.");
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("La cantidad debe ser un entero mayor a cero.");
  await prisma.$transaction(async (tx) => {
    await tx.partRequest.create({
      data: {
        caseId: row.id,
        companyId: row.serviceCompanyId,
        partNumber: input.partNumber,
        description: input.description,
        link: input.link,
        qtyRequested: input.quantity,
      },
    });
    if (row.status === "EN_REPARACION") {
      await tx.technicalCase.update({ where: { id: row.id }, data: { status: "EN_ESPERA_REFACCIONES", version: { increment: 1 } } });
    }
  });
}

export async function receivePartRequest(actor: Actor, requestId: string, version: number, quantity: number) {
  const request = await prisma.partRequest.findUnique({ where: { id: requestId }, include: { case: { include: { serviceCompany: true } } } });
  if (!request || request.companyId !== actor.activeCompanyId) throw new Error("La solicitud no es de esta empresa.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("La cantidad recibida no es válida.");
  const qtyReceived = request.qtyReceived + quantity;
  if (qtyReceived > request.qtyRequested) throw new Error("La recepción supera lo solicitado.");
  const status = request.qtyIssued >= request.qtyRequested ? "SURTIDA" : qtyReceived > 0 ? "EN_ALMACEN" : request.status;
  const company = request.case.serviceCompany;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.partRequest.updateMany({ where: { id: request.id, version }, data: { qtyReceived, status, version: { increment: 1 } } });
    if (updated.count === 0) throw new ConcurrencyError();
    if (company.inventoryEnabled) {
      const part = await tx.part.upsert({
        where: { companyId_partNumber: { companyId: company.id, partNumber: request.partNumber } },
        update: {},
        create: { companyId: company.id, partNumber: request.partNumber, description: request.description, qty: 0 },
      });
      const qtyAfter = part.qty + quantity;
      await tx.part.update({ where: { id: part.id }, data: { qty: qtyAfter, version: { increment: 1 } } });
      await tx.stockMovement.create({
        data: { companyId: company.id, partId: part.id, kind: "ENTRADA", quantity, qtyAfter, note: `Recepción para ${request.case.folio}`, authorUserId: actor.userId },
      });
    }
  });
}

export async function issuePartRequest(actor: Actor, requestId: string, version: number, quantity: number) {
  const request = await prisma.partRequest.findUnique({ where: { id: requestId }, include: { case: { include: { serviceCompany: true, requests: true } } } });
  if (!request || request.companyId !== actor.activeCompanyId) throw new Error("La solicitud no es de esta empresa.");
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("La cantidad surtida no es válida.");
  const available = request.qtyReceived - request.qtyIssued;
  if (quantity > available) throw new Error("No se puede surtir más de lo recibido.");
  const qtyIssued = request.qtyIssued + quantity;
  const status = qtyIssued >= request.qtyRequested ? "SURTIDA" : "EN_ALMACEN";
  await prisma.$transaction(async (tx) => {
    const updated = await tx.partRequest.updateMany({ where: { id: request.id, version }, data: { qtyIssued, status, version: { increment: 1 } } });
    if (updated.count === 0) throw new ConcurrencyError();
    if (request.case.serviceCompany.inventoryEnabled) {
      const part = await tx.part.findUnique({ where: { companyId_partNumber: { companyId: request.companyId, partNumber: request.partNumber } } });
      if (!part || part.qty < quantity) throw new Error("La existencia no alcanza para surtir.");
      const qtyAfter = part.qty - quantity;
      await tx.part.update({ where: { id: part.id }, data: { qty: qtyAfter, version: { increment: 1 } } });
      await tx.stockMovement.create({
        data: { companyId: request.companyId, partId: part.id, kind: "SALIDA", quantity, qtyAfter, note: `Surtido a ${request.case.folio}`, authorUserId: actor.userId },
      });
    }
    const othersOpen = request.case.requests.some((item) => item.id !== request.id && item.qtyIssued < item.qtyRequested);
    const thisOpen = qtyIssued < request.qtyRequested;
    if (!othersOpen && !thisOpen && request.case.status === "EN_ESPERA_REFACCIONES") {
      await tx.technicalCase.update({ where: { id: request.caseId }, data: { status: "EN_REPARACION", version: { increment: 1 } } });
    }
  });
}
