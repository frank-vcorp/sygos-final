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

export async function findInventoryPartForRequest(
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
  const withAvail = rows
    .map((part) => ({ part, avail: partAvailableQty(part) }))
    .filter((row) => row.avail > 0);
  if (withAvail.length === 0) return null;
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
    part = await findInventoryPartForRequest(tx, input.companyId, input.partNumber, input.description);
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
  await syncTechnicalCaseRefaccionesWait(tx, input.caseId);
  return request;
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
