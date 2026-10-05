import { prisma } from "./db";
import { nextCustody, isReceipt, reasonsFor, type Custody, type MovementKind } from "./custody";
import { allocateFolio } from "./folios";
import { ConcurrencyError } from "./form";
import { recordHistory } from "./history";
import { rememberCatalog } from "./catalog";
import { isAttentionType, type AttentionType } from "./priorities";
import { assertWarrantyOrigin, openCase, openPendingCases } from "./technical";

type Actor = {
  userId: string;
  role: string;
  activeCompanyId: string;
  activeCompanyCode: string;
};

async function ownClient(actor: Actor, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, companyId: actor.activeCompanyId, active: true, isSystem: false },
  });
  if (!client) throw new Error("Selecciona un cliente activo de esta empresa.");
  if (actor.role === "VENTAS" && client.ownerUserId !== actor.userId) {
    throw new Error("Ese cliente no está en tu cartera.");
  }
  return client;
}

async function freezePriority(companyId: string, attentionType: AttentionType, priorityId: string) {
  const priority = await prisma.priority.findFirst({
    where: { id: priorityId, companyId, attentionType, active: true },
  });
  if (!priority) throw new Error("Selecciona una prioridad vigente de esta empresa para ese tipo de atención.");
  return priority;
}

export async function createEqui(
  actor: Actor,
  input: {
    clientId: string;
    typeName: string;
    brandName: string;
    model: string;
    description: string | null;
    serial: string | null;
  },
) {
  if (actor.activeCompanyCode !== "SYSTRON") throw new Error("EQUI solo se crea en SYSTRON.");
  const client = await ownClient(actor, input.clientId);
  const identity = await rememberCatalog(input.typeName, input.brandName, input.model);
  const folio = await allocateFolio(actor.activeCompanyId, "EQUI");
  const equipment = await prisma.equipment.create({
    data: {
      kind: "EQUI",
      folio,
      originCompanyId: actor.activeCompanyId,
      clientId: client.id,
      typeName: identity.typeName,
      brandName: identity.brandName,
      model: identity.modelName,
      description: input.description,
      serial: input.serial,
      custody: "SIN_CUSTODIA",
      createdByUserId: actor.userId,
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "EQUIPO",
    entityId: equipment.id,
    action: "ALTA",
    summary: `Alta de ${folio}. Identidad física sin entrada de almacén.`,
    authorUserId: actor.userId,
  });
  return equipment;
}

export async function createMot(
  actor: Actor,
  input: {
    clientId: string;
    typeName: string;
    brand: string | null;
    model: string;
    description: string | null;
    serial: string | null;
    attentionType: string;
    priorityId: string;
    reportedFault: string;
    antecedent: string | null;
    deliveryInstructions: string | null;
  },
) {
  if (input.attentionType === "DIAGNOSTICO_GARANTIA") {
    throw new Error("La garantía se abre sobre un equipo que ya tuvo una reparación, no en el alta del MOT.");
  }
  if (!isAttentionType(input.attentionType)) throw new Error("Selecciona el tipo de atención.");
  const client = await ownClient(actor, input.clientId);
  const identity = await rememberCatalog(input.typeName, input.brand ?? "", input.model);
  const priority = await freezePriority(actor.activeCompanyId, input.attentionType, input.priorityId);
  const servomotores = await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } });
  if (!servomotores) throw new Error("Falta la empresa Servomotores.");
  const adminClient =
    actor.activeCompanyCode === "SYSTRON"
      ? await prisma.client.findUnique({ where: { id: "client-intercompany-systron" } })
      : client;
  if (!adminClient) throw new Error("Falta el cliente fijo SYSTRON en Servomotores.");
  const folio = await allocateFolio(actor.activeCompanyId, "MOT");
  const equipment = await prisma.equipment.create({
    data: {
      kind: "MOT",
      folio,
      originCompanyId: actor.activeCompanyId,
      clientId: client.id,
      typeName: identity.typeName,
      brandName: identity.brandName,
      model: identity.modelName,
      description: input.description,
      serial: input.serial,
      custody: "PENDIENTE_INGRESO",
      createdByUserId: actor.userId,
    },
  });
  await prisma.attention.create({
    data: {
      equipmentId: equipment.id,
      originCompanyId: actor.activeCompanyId,
      serviceCompanyId: servomotores.id,
      adminClientId: adminClient.id,
      attentionType: input.attentionType,
      priorityName: priority.name,
      priorityPrice: priority.price,
      priorityIncrementPct: priority.incrementPct,
      priorityTargetMin: priority.targetMinDays,
      priorityTargetMax: priority.targetMaxDays,
      prioritySlaMaxDays: priority.slaMaxDays,
      reportedFault: input.reportedFault,
      antecedent: input.antecedent,
      deliveryInstructions: input.deliveryInstructions,
      sellerUserId: actor.role === "VENTAS" ? actor.userId : client.ownerUserId,
      status: "ABIERTA",
    },
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "EQUIPO",
    entityId: equipment.id,
    action: "ALTA",
    summary:
      actor.activeCompanyCode === "SYSTRON"
        ? `${folio} creado en SYSTRON. No entra a almacén SYSTRON; queda pendiente de ingreso en Servomotores.`
        : `${folio} creado para un cliente de Servomotores. Pendiente de ingreso físico.`,
    authorUserId: actor.userId,
  });
  return equipment;
}

export async function createAttention(
  actor: Actor,
  input: {
    equipmentId: string;
    attentionType: string;
    priorityId: string;
    reportedFault: string;
    antecedent: string | null;
    deliveryInstructions: string | null;
    originalCaseId: string | null;
    version: number;
  },
) {
  if (!isAttentionType(input.attentionType)) throw new Error("Selecciona el tipo de atención.");
  if (input.attentionType === "DIAGNOSTICO_GARANTIA") {
    if (!input.antecedent) throw new Error("Describe el antecedente del reclamo de garantía.");
    if (!input.originalCaseId) throw new Error("Selecciona la reparación pagada que origina la garantía.");
    await assertWarrantyOrigin(input.equipmentId, input.originalCaseId);
  }
  const equipment = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!equipment || equipment.originCompanyId !== actor.activeCompanyId) {
    throw new Error("La atención se crea en la empresa que originó el equipo.");
  }
  const priority = await freezePriority(actor.activeCompanyId, input.attentionType, input.priorityId);
  const service =
    equipment.kind === "MOT"
      ? await prisma.company.findUnique({ where: { code: "SERVOMOTORES" } })
      : await prisma.company.findUnique({ where: { id: equipment.originCompanyId } });
  if (!service) throw new Error("No está definida la empresa que ejecuta el servicio.");
  const client = await prisma.client.findUnique({ where: { id: equipment.clientId } });
  const adminClient =
    equipment.kind === "MOT" && actor.activeCompanyCode === "SYSTRON"
      ? await prisma.client.findUnique({ where: { id: "client-intercompany-systron" } })
      : client;
  if (!adminClient || !client) throw new Error("Falta el cliente administrativo de la atención.");
  const inServiceCustody = equipment.custody === "EN_RESGUARDO" && equipment.holderCompanyId === service.id;
  const needsIngress = equipment.kind === "MOT" && equipment.custody === "FUERA";
  const attention = await prisma.$transaction(async (tx) => {
    const updated = await tx.equipment.updateMany({
      where: { id: equipment.id, version: input.version },
      data: {
        ...(needsIngress ? { custody: "PENDIENTE_INGRESO", holderCompanyId: null } : {}),
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    return tx.attention.create({
      data: {
        equipmentId: equipment.id,
        originCompanyId: equipment.originCompanyId,
        serviceCompanyId: service.id,
        adminClientId: adminClient.id,
        attentionType: input.attentionType,
        priorityName: priority.name,
        priorityPrice: priority.price,
        priorityIncrementPct: priority.incrementPct,
        priorityTargetMin: priority.targetMinDays,
        priorityTargetMax: priority.targetMaxDays,
        prioritySlaMaxDays: priority.slaMaxDays,
        reportedFault: input.reportedFault,
        antecedent: input.antecedent,
        deliveryInstructions: input.deliveryInstructions,
        sellerUserId: actor.role === "VENTAS" ? actor.userId : client.ownerUserId,
        originalCaseId: input.originalCaseId,
        status: inServiceCustody ? "EN_PROCESO" : "ABIERTA",
        slaStartedAt: inServiceCustody ? new Date() : null,
      },
    });
  });
  if (attention.slaStartedAt) await openCase(attention.id, attention.slaStartedAt);
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "EQUIPO",
    entityId: equipment.id,
    action: "ATENCION",
    summary: `Nueva atención ${input.attentionType} con prioridad ${priority.name}. No sustituye la identidad ${equipment.folio}.`,
    authorUserId: actor.userId,
  });
  return attention;
}

export async function startService(
  actor: Actor,
  input: {
    attentionType: AttentionType;
    clientId: string | null;
    newClientName: string | null;
    contactName: string | null;
    equipmentId: string | null;
    equipmentKind: "EQUI" | "MOT" | null;
    model: string | null;
    typeName: string | null;
    brandName: string | null;
    serial: string | null;
    priorityId: string;
    reportedFault: string;
    antecedent: string | null;
    originalCaseId: string | null;
    deliveryInstructions: string | null;
  },
) {
  let clientId = input.clientId;
  if (!input.equipmentId && !clientId) {
    if (!input.newClientName || !input.contactName) throw new Error("Para un cliente nuevo indica el nombre y un contacto.");
    const ownerUserId = await ownerFor(actor);
    const created = await prisma.client.create({
      data: {
        companyId: actor.activeCompanyId,
        name: input.newClientName,
        ownerUserId,
        contacts: { create: { name: input.contactName, isPrimary: true } },
      },
    });
    clientId = created.id;
  }
  let equipmentId = input.equipmentId;
  let version = 1;
  if (!equipmentId) {
    if (!clientId) throw new Error("Elige un cliente o abre el alta rápida e indica su nombre y un contacto.");
    if (!input.model) throw new Error("Elige un equipo existente o escribe el modelo en el alta rápida de equipo.");
    if (input.attentionType === "DIAGNOSTICO_GARANTIA") {
      throw new Error("La garantía se abre sobre un equipo que ya tuvo una reparación pagada.");
    }
    if (input.equipmentKind === "EQUI") {
      const equipment = await createEqui(actor, {
        clientId,
        typeName: input.typeName ?? "",
        brandName: input.brandName ?? "",
        model: input.model,
        description: null,
        serial: input.serial,
      });
      equipmentId = equipment.id;
    } else if (input.equipmentKind === "MOT") {
      const client = await ownClient(actor, clientId);
      const identity = await rememberCatalog(input.typeName ?? "", input.brandName ?? "", input.model);
      const folio = await allocateFolio(actor.activeCompanyId, "MOT");
      const equipment = await prisma.equipment.create({
        data: {
          kind: "MOT",
          folio,
          originCompanyId: actor.activeCompanyId,
          clientId: client.id,
          typeName: identity.typeName,
          brandName: identity.brandName,
          model: identity.modelName,
          serial: input.serial,
          custody: "PENDIENTE_INGRESO",
          createdByUserId: actor.userId,
        },
      });
      equipmentId = equipment.id;
    } else {
      throw new Error("Indica si el equipo es EQUI o MOT.");
    }
  } else {
    const current = await prisma.equipment.findFirst({ where: { id: equipmentId, originCompanyId: actor.activeCompanyId } });
    if (!current) throw new Error("Ese equipo no pertenece a la empresa activa.");
    version = current.version;
    clientId = current.clientId;
  }
  return createAttention(actor, {
    equipmentId,
    attentionType: input.attentionType,
    priorityId: input.priorityId,
    reportedFault: input.reportedFault,
    antecedent: input.antecedent,
    deliveryInstructions: input.deliveryInstructions,
    originalCaseId: input.originalCaseId,
    version,
  });
}

async function ownerFor(actor: Actor) {
  if (actor.role === "VENTAS" || actor.role === "GERENTE_OPERATIVO_SERVOMOTORES" || actor.role === "CEO") return actor.userId;
  if (actor.role === "COORDINACION_ADMINISTRACION" || actor.role === "ADMINISTRADOR") {
    const ceo = await prisma.user.findFirst({ where: { role: "CEO", active: true }, orderBy: { username: "asc" } });
    return ceo?.id ?? null;
  }
  return null;
}

export async function registerMovement(
  actor: Actor,
  input: {
    equipmentId: string;
    version: number;
    kind: MovementKind;
    reason: string;
    occurredAt: Date;
    receiverName: string | null;
    deliveryMode: string | null;
    contact: string | null;
    enablingDocument: string | null;
    supplierId: string | null;
    notes: string | null;
  },
) {
  const equipment = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!equipment) throw new Error("No se encontró el equipo.");
  assertMovementCompany(actor, equipment.kind);
  if (equipment.kind === "MOT" && actor.activeCompanyCode === "SYSTRON") {
    throw new Error("Un MOT trabajado por Servomotores no pasa por almacén SYSTRON.");
  }
  if (equipment.kind === "EQUI" && actor.activeCompanyCode !== "SYSTRON") {
    throw new Error("El almacén de este EQUI es SYSTRON.");
  }
  if (equipment.kind === "MOT" && equipment.originCompanyId !== actor.activeCompanyId && actor.activeCompanyCode === "SYSTRON") {
    throw new Error("SYSTRON no registra la custodia de este MOT.");
  }
  if ((input.kind === "SALIDA" || input.kind === "EGRESO") && (!input.enablingDocument || !input.deliveryMode || !input.receiverName)) {
    throw new Error("La salida definitiva exige documento habilitante, modalidad de entrega y persona que recibe.");
  }
  if (input.kind === "SALIDA_PRUEBA" && !input.receiverName) {
    throw new Error("Indica el receptor o el contexto de la salida a prueba.");
  }
  if (input.kind === "SALIDA_PROVEEDOR") {
    if (!input.supplierId) throw new Error("Selecciona el proveedor.");
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, companyId: actor.activeCompanyId, active: true },
    });
    if (!supplier) throw new Error("Ese proveedor no está activo en esta empresa.");
  }
  if (!reasonsFor(input.kind).includes(input.reason)) {
    throw new Error("El motivo no pertenece al catálogo de este movimiento.");
  }
  const kind = equipment.kind === "MOT" ? "MOT" : "EQUI";
  const custody = nextCustody(kind, equipment.custody as Custody, input.kind);
  const attention = await prisma.attention.findFirst({
    where: { equipmentId: equipment.id, status: "ABIERTA" },
    orderBy: { createdAt: "desc" },
  });
  await prisma.$transaction(async (tx) => {
    const updated = await tx.equipment.updateMany({
      where: { id: equipment.id, version: input.version },
      data: {
        custody,
        holderCompanyId: custody === "EN_RESGUARDO" ? actor.activeCompanyId : null,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await tx.custodyMovement.create({
      data: {
        equipmentId: equipment.id,
        companyId: actor.activeCompanyId,
        attentionId: attention?.id ?? null,
        kind: input.kind,
        reason: input.reason,
        receiverName: input.receiverName,
        deliveryMode: input.deliveryMode,
        contact: input.contact,
        enablingDocument: input.enablingDocument,
        supplierId: input.supplierId,
        notes: input.notes,
        authorUserId: actor.userId,
        occurredAt: input.occurredAt,
      },
    });
    if (isReceipt(input.kind)) {
      await tx.attention.updateMany({
        where: { equipmentId: equipment.id, slaStartedAt: null },
        data: { status: "EN_PROCESO", slaStartedAt: input.occurredAt },
      });
    }
  });
  if (isReceipt(input.kind)) {
    await openPendingCases(equipment.id, input.occurredAt);
    const { openWaitingRepairs } = await import("./quotes");
    await openWaitingRepairs(equipment.id, actor.userId);
  }
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "EQUIPO",
    entityId: equipment.id,
    action: "CUSTODIA",
    summary: `${input.kind} confirmado. Custodia: ${custody}.`,
    authorUserId: actor.userId,
  });
}

export async function cancelMovement(actor: Actor, movementId: string, reason: string) {
  const movement = await prisma.custodyMovement.findUnique({
    where: { id: movementId },
    include: { equipment: true },
  });
  if (!movement || movement.cancelledAt || movement.companyId !== actor.activeCompanyId) {
    throw new Error("Ese movimiento no se puede corregir desde esta empresa.");
  }
  if (movement.kind === "ENTRADA" || movement.kind === "INGRESO") {
    throw new Error("Una entrada que ya pudo iniciar actividad técnica no se cancela de forma simple.");
  }
  const later = await prisma.custodyMovement.count({
    where: { equipmentId: movement.equipmentId, cancelledAt: null, createdAt: { gt: movement.createdAt } },
  });
  if (later > 0) throw new Error("Solo se cancela el último movimiento físico.");
  const remaining = await prisma.custodyMovement.findMany({
    where: { equipmentId: movement.equipmentId, cancelledAt: null, id: { not: movement.id } },
    orderBy: { createdAt: "asc" },
  });
  let custody: Custody = movement.equipment.kind === "EQUI" ? "SIN_CUSTODIA" : "PENDIENTE_INGRESO";
  let holder: string | null = null;
  for (const row of remaining) {
    custody = nextCustody(movement.equipment.kind === "MOT" ? "MOT" : "EQUI", custody, row.kind as MovementKind);
    holder = custody === "EN_RESGUARDO" ? row.companyId : null;
  }
  await prisma.$transaction(async (tx) => {
    await tx.custodyMovement.update({
      where: { id: movement.id },
      data: { cancelledAt: new Date(), cancelReason: reason },
    });
    await tx.equipment.update({
      where: { id: movement.equipmentId },
      data: { custody, holderCompanyId: holder, version: { increment: 1 } },
    });
  });
  await recordHistory({
    companyId: actor.activeCompanyId,
    entityType: "EQUIPO",
    entityId: movement.equipmentId,
    action: "CUSTODIA",
    summary: `Movimiento cancelado: ${reason}`,
    authorUserId: actor.userId,
  });
}

function assertMovementCompany(actor: Actor, kind: string) {
  if (kind === "EQUI" && actor.activeCompanyCode !== "SYSTRON") {
    throw new Error("La custodia de EQUI se registra en SYSTRON.");
  }
  if (kind === "MOT" && actor.activeCompanyCode !== "SERVOMOTORES") {
    throw new Error("La custodia de MOT se registra en Servomotores.");
  }
}

export async function changeStock(
  actor: Actor,
  input: { partId: string; version: number; kind: "ENTRADA" | "SALIDA"; quantity: number; note: string | null },
) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("La cantidad debe ser un entero mayor a cero.");
  const part = await prisma.part.findFirst({ where: { id: input.partId, companyId: actor.activeCompanyId, active: true } });
  if (!part) throw new Error("La refacción no está en el inventario de esta empresa.");
  const delta = input.kind === "ENTRADA" ? input.quantity : -input.quantity;
  const qtyAfter = part.qty + delta;
  if (qtyAfter < 0) throw new Error("La salida supera la existencia. No hay reservas ni existencias negativas.");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.part.updateMany({
      where: { id: part.id, version: input.version },
      data: { qty: qtyAfter, version: { increment: 1 } },
    });
    if (updated.count === 0) throw new ConcurrencyError();
    await tx.stockMovement.create({
      data: {
        companyId: actor.activeCompanyId,
        partId: part.id,
        kind: input.kind,
        quantity: input.quantity,
        qtyAfter,
        note: input.note,
        authorUserId: actor.userId,
      },
    });
  });
}

export async function applyCount(
  actor: Actor,
  rows: Array<{ partNumber: string; counted: number }>,
) {
  const parts = await prisma.part.findMany({ where: { companyId: actor.activeCompanyId, active: true } });
  const byNumber = new Map(parts.map((part) => [part.partNumber, part]));
  const changes: Array<{ partId: string; version: number; from: number; to: number; partNumber: string }> = [];
  for (const row of rows) {
    const part = byNumber.get(row.partNumber);
    if (!part) throw new Error(`No existe la refacción ${row.partNumber} en esta empresa.`);
    if (!Number.isInteger(row.counted) || row.counted < 0) throw new Error(`El conteo de ${row.partNumber} no es válido.`);
    if (part.qty !== row.counted) {
      changes.push({ partId: part.id, version: part.version, from: part.qty, to: row.counted, partNumber: part.partNumber });
    }
  }
  await prisma.$transaction(async (tx) => {
    for (const change of changes) {
      const updated = await tx.part.updateMany({
        where: { id: change.partId, version: change.version },
        data: { qty: change.to, version: { increment: 1 } },
      });
      if (updated.count === 0) throw new ConcurrencyError();
      await tx.stockMovement.create({
        data: {
          companyId: actor.activeCompanyId,
          partId: change.partId,
          kind: "AJUSTE",
          quantity: change.to - change.from,
          qtyAfter: change.to,
          note: `Conteo físico ${change.from} → ${change.to}`,
          authorUserId: actor.userId,
        },
      });
    }
  });
  return changes.length;
}
