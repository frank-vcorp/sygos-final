import type { Part, PartRequest, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export function partAvailableQty(part: Pick<Part, "qty" | "qtyReserved">) {
  return Math.max(0, part.qty - part.qtyReserved);
}

/** Cantidad lista para surtir sin depender de compras pendientes. */
export function partRequestIssueable(request: Pick<PartRequest, "qtyReserved" | "qtyReceived" | "qtyIssued">) {
  return request.qtyReserved + request.qtyReceived - request.qtyIssued;
}

/** Piezas que aún faltan por conseguir (compra o entrada), sin contar lo ya apartado o recibido. */
export function partRequestShortfall(request: Pick<PartRequest, "qtyRequested" | "qtyReserved" | "qtyReceived">) {
  return Math.max(0, request.qtyRequested - request.qtyReserved - request.qtyReceived);
}

export function partRequestNeedsSupply(request: Pick<PartRequest, "qtyRequested" | "qtyReserved" | "qtyReceived" | "qtyIssued">) {
  return request.qtyIssued < request.qtyRequested && partRequestShortfall(request) > 0;
}

export function partRequestStatusAfterMove(
  request: Pick<PartRequest, "qtyRequested" | "qtyReserved" | "qtyReceived" | "qtyIssued" | "status">,
) {
  if (request.qtyIssued >= request.qtyRequested) return "SURTIDA";
  if (partRequestIssueable(request) > 0) return "EN_ALMACEN";
  if (request.qtyReceived > 0) return "EN_ALMACEN";
  return request.status === "SOLICITADA" ? "SOLICITADA" : request.status;
}

export async function findCatalogPartForRequest(
  tx: Tx,
  companyId: string,
  partNumber: string,
  description: string,
): Promise<Part | null> {
  const pn = partNumber.trim();
  const desc = description.trim();
  const rows = await tx.part.findMany({
    where: { companyId, active: true, partNumber: pn },
    orderBy: [{ rack: "asc" }, { nivel: "asc" }, { catalogLine: "asc" }],
  });
  if (rows.length === 0) return null;
  const withAvail = rows.map((part) => ({ part, avail: partAvailableQty(part) }));
  if (desc) {
    const exact = withAvail.filter((row) => row.part.description.trim() === desc);
    if (exact.length > 0) {
      exact.sort((a, b) => b.avail - a.avail);
      return exact[0]!.part;
    }
  }
  withAvail.sort((a, b) => b.avail - a.avail);
  return withAvail[0]!.part;
}

export async function findInventoryPartForRequest(
  tx: Tx,
  companyId: string,
  partNumber: string,
  description: string,
): Promise<Part | null> {
  const part = await findCatalogPartForRequest(tx, companyId, partNumber, description);
  if (!part || partAvailableQty(part) <= 0) return null;
  return part;
}

export async function reserveInventoryForPartRequest(
  tx: Tx,
  input: {
    companyId: string;
    inventoryEnabled: boolean;
    partNumber: string;
    description: string;
    qtyRequested: number;
    inventoryPartId?: string | null;
  },
): Promise<{ partId: string | null; qtyReserved: number }> {
  if (!input.inventoryEnabled) return { partId: null, qtyReserved: 0 };
  let part: Part | null = null;
  if (input.inventoryPartId) {
    part = await tx.part.findFirst({
      where: { id: input.inventoryPartId, companyId: input.companyId, active: true },
    });
  }
  if (!part) {
    part =
      (await findInventoryPartForRequest(tx, input.companyId, input.partNumber, input.description))
      ?? (await findCatalogPartForRequest(tx, input.companyId, input.partNumber, input.description));
  }
  if (!part) return { partId: null, qtyReserved: 0 };
  const avail = partAvailableQty(part);
  const toReserve = Math.min(input.qtyRequested, avail);
  if (toReserve <= 0) return { partId: part.id, qtyReserved: 0 };
  const updated = await tx.part.updateMany({
    where: { id: part.id, version: part.version },
    data: { qtyReserved: { increment: toReserve }, version: { increment: 1 } },
  });
  if (updated.count === 0) throw new Error("No se pudo apartar la refacción. Intenta de nuevo.");
  return { partId: part.id, qtyReserved: toReserve };
}

export async function createPartRequestWithReservation(
  tx: Tx,
  input: {
    caseId: string;
    companyId: string;
    inventoryEnabled: boolean;
    partNumber: string;
    description: string;
    link: string | null;
    qtyRequested: number;
    inventoryPartId?: string | null;
    requesterUserId: string;
  },
) {
  const reserve = await reserveInventoryForPartRequest(tx, {
    companyId: input.companyId,
    inventoryEnabled: input.inventoryEnabled,
    partNumber: input.partNumber,
    description: input.description,
    qtyRequested: input.qtyRequested,
    inventoryPartId: input.inventoryPartId,
  });
  const status = reserve.qtyReserved > 0 ? "EN_ALMACEN" : "SOLICITADA";
  const request = await tx.partRequest.create({
    data: {
      caseId: input.caseId,
      companyId: input.companyId,
      partId: reserve.partId,
      partNumber: input.partNumber.trim(),
      description: input.description.trim(),
      link: input.link,
      qtyRequested: input.qtyRequested,
      qtyReserved: reserve.qtyReserved,
      status,
    },
  });
  const shortfall = partRequestShortfall(request);
  if (shortfall > 0) {
    await tx.requirement.upsert({
      where: { companyId_sourceType_sourceId: { companyId: input.companyId, sourceType: "OS", sourceId: request.id } },
      update: {
        partNumber: request.partNumber,
        description: request.description,
        quantity: shortfall,
        kind: "REFACCION",
      },
      create: {
        companyId: input.companyId,
        partNumber: request.partNumber,
        description: request.description,
        quantity: shortfall,
        kind: "REFACCION",
        requesterUserId: input.requesterUserId,
        sourceType: "OS",
        sourceId: request.id,
      },
    });
  } else {
    await tx.requirement.deleteMany({
      where: {
        companyId: input.companyId,
        sourceType: "OS",
        sourceId: request.id,
        status: "PENDIENTE",
      },
    });
  }
  await syncTechnicalCaseRefaccionesWait(tx, input.caseId);
  return request;
}

export async function releasePartRequestReservationToPurchase(
  tx: Tx,
  input: {
    requestId: string;
    companyId: string;
    version: number;
    actorUserId: string;
  },
) {
  const request = await tx.partRequest.findUnique({
    where: { id: input.requestId },
    include: {
      case: {
        include: { serviceCompany: true },
      },
    },
  });
  if (!request || request.companyId !== input.companyId) {
    throw new Error("La solicitud no pertenece a esta empresa.");
  }
  if (request.qtyReserved <= 0) {
    throw new Error("Esta solicitud no tiene piezas apartadas en almacén.");
  }
  const releasedQty = request.qtyReserved;
  const nextIssueable = partRequestIssueable({ ...request, qtyReserved: 0 });
  const nextStatus =
    request.qtyIssued >= request.qtyRequested
      ? "SURTIDA"
      : nextIssueable > 0
        ? "EN_ALMACEN"
        : "SOLICITADA";

  const updated = await tx.partRequest.updateMany({
    where: { id: request.id, version: input.version },
    data: {
      qtyReserved: 0,
      status: nextStatus,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) {
    throw new Error("El registro fue modificado por otro usuario. Recarga la página e intenta de nuevo.");
  }

  if (request.partId && request.case.serviceCompany.inventoryEnabled) {
    const part = await tx.part.findFirst({
      where: { id: request.partId, companyId: request.companyId },
    });
    if (part) {
      await tx.part.update({
        where: { id: part.id },
        data: {
          qtyReserved: Math.max(0, part.qtyReserved - releasedQty),
          version: { increment: 1 },
        },
      });
    }
  }

  const shortfall = partRequestShortfall({ ...request, qtyReserved: 0 });
  if (shortfall > 0) {
    const requesterUserId = request.case.assigneeUserId ?? input.actorUserId;
    const existing = await tx.requirement.findUnique({
      where: {
        companyId_sourceType_sourceId: {
          companyId: request.companyId,
          sourceType: "OS",
          sourceId: request.id,
        },
      },
      include: { shoppingListLine: true },
    });
    if (!existing) {
      await tx.requirement.create({
        data: {
          companyId: request.companyId,
          partNumber: request.partNumber,
          description: request.description,
          quantity: shortfall,
          kind: "REFACCION",
          status: "PENDIENTE",
          requesterUserId,
          sourceType: "OS",
          sourceId: request.id,
        },
      });
    } else if (existing.status === "PENDIENTE") {
      await tx.requirement.update({
        where: { id: existing.id },
        data: {
          partNumber: request.partNumber,
          description: request.description,
          quantity: shortfall,
          kind: "REFACCION",
        },
      });
    } else if (existing.status === "EN_LISTA") {
      await tx.requirement.update({
        where: { id: existing.id },
        data: {
          partNumber: request.partNumber,
          description: request.description,
          quantity: shortfall,
          kind: "REFACCION",
        },
      });
      if (existing.shoppingListLine) {
        await tx.shoppingListLine.update({
          where: { id: existing.shoppingListLine.id },
          data: { quantity: shortfall },
        });
      }
    } else {
      await tx.requirement.update({
        where: { id: existing.id },
        data: {
          partNumber: request.partNumber,
          description: request.description,
          quantity: releasedQty,
          kind: "REFACCION",
          status: "PENDIENTE",
          purchaseId: null,
          shoppingListId: null,
        },
      });
    }
  }

  await syncTechnicalCaseRefaccionesWait(tx, request.caseId);
  return {
    requestId: request.id,
    caseId: request.caseId,
    releasedQty,
    shortfall,
    status: nextStatus,
  };
}

export type PurchaseSourceLineSlice = {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  sourceType: string | null;
  sourceId: string | null;
  requirement?: {
    sourceType: string | null;
    sourceId: string | null;
  } | null;
};

export type PartRequestReceiveSlice = Pick<
  PartRequest,
  "id" | "version" | "qtyRequested" | "qtyReserved" | "qtyReceived" | "qtyIssued" | "partNumber" | "description" | "caseId"
>;

export type PendingPurchaseLineReceive = {
  lineId: string;
  partRequestId: string;
  caseId: string;
  version: number;
  partNumber: string;
  description: string;
  purchasedQty: number;
  qtyToReceive: number;
  shortfall: number;
};

export function resolvePendingPartReceivesForPurchase(input: {
  lines: PurchaseSourceLineSlice[];
  requirements?: Array<{
    id: string;
    partNumber: string;
    description: string;
    quantity: number;
    sourceType: string | null;
    sourceId: string | null;
  }>;
  partRequestsById: Map<string, PartRequestReceiveSlice>;
  dxPresolicitudToPartRequestId?: Map<string, string>;
}): {
  lines: PendingPurchaseLineReceive[];
  aggregatedByRequest: Array<{ requestId: string; version: number; qtyToReceive: number }>;
} {
  const sourceItems: PurchaseSourceLineSlice[] =
    input.lines.length > 0
      ? input.lines
      : (input.requirements ?? []).map((req) => ({
          id: req.id,
          partNumber: req.partNumber,
          description: req.description,
          quantity: req.quantity,
          sourceType: req.sourceType,
          sourceId: req.sourceId,
          requirement: null,
        }));

  const remainingShortfallByPr = new Map<string, number>();
  const pendingLines: PendingPurchaseLineReceive[] = [];
  const aggByPr = new Map<string, { requestId: string; version: number; qtyToReceive: number }>();

  for (const item of sourceItems) {
    const srcType = item.sourceType ?? item.requirement?.sourceType ?? null;
    const srcId = item.sourceId ?? item.requirement?.sourceId ?? null;
    if (!srcType || !srcId) continue;
    const partRequestId =
      srcType === "OS"
        ? srcId
        : srcType === "DX"
          ? input.dxPresolicitudToPartRequestId?.get(srcId) ?? null
          : null;
    if (!partRequestId) continue;

    const pr = input.partRequestsById.get(partRequestId);
    if (!pr || pr.qtyIssued >= pr.qtyRequested) continue;

    const currentShortfall = remainingShortfallByPr.get(pr.id) ?? partRequestShortfall(pr);
    if (currentShortfall <= 0) continue;

    const qtyToReceive = Math.min(Math.max(0, item.quantity), currentShortfall);
    if (qtyToReceive <= 0) continue;

    remainingShortfallByPr.set(pr.id, currentShortfall - qtyToReceive);
    pendingLines.push({
      lineId: item.id,
      partRequestId: pr.id,
      caseId: pr.caseId,
      version: pr.version,
      partNumber: item.partNumber || pr.partNumber,
      description: item.description || pr.description,
      purchasedQty: item.quantity,
      qtyToReceive,
      shortfall: partRequestShortfall(pr),
    });

    const existingAgg = aggByPr.get(pr.id);
    if (existingAgg) {
      existingAgg.qtyToReceive += qtyToReceive;
    } else {
      aggByPr.set(pr.id, {
        requestId: pr.id,
        version: pr.version,
        qtyToReceive,
      });
    }
  }

  return {
    lines: pendingLines,
    aggregatedByRequest: [...aggByPr.values()],
  };
}

export async function syncTechnicalCaseRefaccionesWait(tx: Tx, caseId: string) {
  const row = await tx.technicalCase.findUnique({
    where: { id: caseId },
    include: { requests: true },
  });
  if (!row || row.kind !== "OS") return;
  if (!["EN_REPARACION", "EN_ESPERA_REFACCIONES"].includes(row.status)) return;
  const waiting = row.requests.some((request) => partRequestNeedsSupply(request));
  const next = waiting ? "EN_ESPERA_REFACCIONES" : "EN_REPARACION";
  if (next !== row.status) {
    await tx.technicalCase.update({
      where: { id: caseId },
      data: { status: next, version: { increment: 1 } },
    });
  }
}
