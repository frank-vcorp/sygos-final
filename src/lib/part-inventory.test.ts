import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Part, Prisma } from "@prisma/client";
import {
  createPartRequestWithReservation,
  partAvailableQty,
  partRequestIssueable,
  partRequestNeedsSupply,
  partRequestShortfall,
  releasePartRequestReservationToPurchase,
  resolvePendingPartReceivesForPurchase,
} from "./part-inventory";

function createMockTx(initial: {
  part?: Partial<Part> & { id: string; qty: number; qtyReserved: number; version?: number };
  existingRequirement?: {
    id: string;
    status: string;
    quantity: number;
    shoppingListLine?: { id: string; quantity: number } | null;
  } | null;
}) {
  const state = {
    part: initial.part
      ? ({
          id: initial.part.id,
          companyId: "comp-1",
          partNumber: initial.part.partNumber ?? "SKF-6205",
          description: initial.part.description ?? "Balero rígido",
          searchKey: "skf 6205 balero rigido",
          catalogNumero: "",
          family: "BALEROS",
          rack: "2",
          nivel: "4",
          unit: "PZA",
          mountType: "",
          catalogLine: 10,
          qty: initial.part.qty,
          qtyReserved: initial.part.qtyReserved,
          minQty: null,
          maxQty: null,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: initial.part.version ?? 1,
        } satisfies Part)
      : null,
    createdPartRequest: null as null | {
      id: string;
      caseId: string;
      companyId: string;
      partId: string | null;
      partNumber: string;
      description: string;
      link: string | null;
      qtyRequested: number;
      qtyReserved: number;
      qtyReceived: number;
      qtyIssued: number;
      status: string;
      version: number;
    },
    upsertedRequirement: null as null | {
      partNumber: string;
      description: string;
      quantity: number;
      kind: string;
      sourceType: string;
      sourceId: string;
    },
    deletedPendingRequirements: 0,
    createdRequirement: null as null | { quantity: number; status: string },
    updatedRequirement: null as null | { quantity: number; status?: string },
    updatedShoppingListLineQty: null as null | number,
    caseStatus: "EN_REPARACION",
  };

  const tx = {
    part: {
      findFirst: async () => state.part,
      findMany: async () => (state.part ? [state.part] : []),
      updateMany: async ({ data }: { data: { qtyReserved: { increment: number } } }) => {
        if (!state.part) return { count: 0 };
        state.part.qtyReserved += data.qtyReserved.increment;
        state.part.version += 1;
        return { count: 1 };
      },
      update: async ({ data }: { data: { qtyReserved: number } }) => {
        if (state.part) {
          state.part.qtyReserved = data.qtyReserved;
          state.part.version += 1;
        }
        return state.part;
      },
    },
    partRequest: {
      create: async ({
        data,
      }: {
        data: {
          caseId: string;
          companyId: string;
          partId: string | null;
          partNumber: string;
          description: string;
          link: string | null;
          qtyRequested: number;
          qtyReserved: number;
          status: string;
        };
      }) => {
        state.createdPartRequest = {
          id: "pr-1",
          ...data,
          qtyReceived: 0,
          qtyIssued: 0,
          version: 1,
        };
        return state.createdPartRequest;
      },
      findUnique: async () =>
        state.createdPartRequest
          ? {
              ...state.createdPartRequest,
              case: {
                id: state.createdPartRequest.caseId,
                assigneeUserId: "tech-1",
                serviceCompany: { id: "comp-1", inventoryEnabled: true },
              },
            }
          : null,
      updateMany: async ({ data }: { data: { qtyReserved: number; status: string } }) => {
        if (!state.createdPartRequest) return { count: 0 };
        state.createdPartRequest.qtyReserved = data.qtyReserved;
        state.createdPartRequest.status = data.status;
        state.createdPartRequest.version += 1;
        return { count: 1 };
      },
    },
    requirement: {
      upsert: async ({
        create,
      }: {
        create: {
          partNumber: string;
          description: string;
          quantity: number;
          kind: string;
          sourceType: string;
          sourceId: string;
        };
      }) => {
        state.upsertedRequirement = create;
        return create;
      },
      deleteMany: async () => {
        state.deletedPendingRequirements += 1;
        return { count: 1 };
      },
      findUnique: async () => initial.existingRequirement ?? null,
      create: async ({ data }: { data: { quantity: number; status: string } }) => {
        state.createdRequirement = { quantity: data.quantity, status: data.status };
        return data;
      },
      update: async ({ data }: { data: { quantity: number; status?: string } }) => {
        state.updatedRequirement = { quantity: data.quantity, status: data.status };
        return data;
      },
    },
    shoppingListLine: {
      update: async ({ data }: { data: { quantity: number } }) => {
        state.updatedShoppingListLineQty = data.quantity;
        return data;
      },
    },
    technicalCase: {
      findUnique: async () => ({
        id: "case-1",
        kind: "OS",
        status: state.caseStatus,
        requests: state.createdPartRequest ? [state.createdPartRequest] : [],
      }),
      update: async ({ data }: { data: { status: string } }) => {
        state.caseStatus = data.status;
        return { id: "case-1", status: data.status };
      },
    },
  } as unknown as Prisma.TransactionClient;

  return { tx, state };
}

describe("inventario y solicitudes de refacción", () => {
  it("calcula existencia disponible descontando apartados", () => {
    assert.equal(partAvailableQty({ qty: 10, qtyReserved: 3 }), 7);
  });

  it("permite surtir desde apartado sin recepción previa", () => {
    const request = { qtyRequested: 5, qtyReserved: 5, qtyReceived: 0, qtyIssued: 0 };
    assert.equal(partRequestIssueable(request), 5);
    assert.equal(partRequestShortfall(request), 0);
    assert.equal(partRequestNeedsSupply(request), false);
  });

  it("marca faltante cuando no hay stock ni recepción", () => {
    const request = { qtyRequested: 8, qtyReserved: 2, qtyReceived: 0, qtyIssued: 0 };
    assert.equal(partRequestShortfall(request), 6);
    assert.equal(partRequestNeedsSupply(request), true);
  });

  it("combina apartado y recibido para surtido", () => {
    const request = { qtyRequested: 10, qtyReserved: 3, qtyReceived: 4, qtyIssued: 2 };
    assert.equal(partRequestIssueable(request), 5);
    assert.equal(partRequestShortfall(request), 3);
  });

  it("stock completo (5 de 5): aparta 5 para almacén y NO crea requerimiento de compra para Samuel", async () => {
    const { tx, state } = createMockTx({
      part: { id: "part-1", qty: 5, qtyReserved: 0 },
    });

    const req = await createPartRequestWithReservation(tx, {
      caseId: "case-1",
      companyId: "comp-1",
      inventoryEnabled: true,
      partNumber: "SKF-6205",
      description: "Balero rígido",
      link: null,
      qtyRequested: 5,
      requesterUserId: "tech-1",
    });

    assert.equal(req.qtyReserved, 5);
    assert.equal(req.status, "EN_ALMACEN");
    assert.equal(state.upsertedRequirement, null);
    assert.equal(state.deletedPendingRequirements, 1);
    assert.equal(state.caseStatus, "EN_REPARACION");
  });

  it("stock parcial (pide 5, hay 2): aparta 2 para almacén y crea requerimiento por las 3 faltantes para Samuel", async () => {
    const { tx, state } = createMockTx({
      part: { id: "part-1", qty: 2, qtyReserved: 0 },
    });

    const req = await createPartRequestWithReservation(tx, {
      caseId: "case-1",
      companyId: "comp-1",
      inventoryEnabled: true,
      partNumber: "SKF-6205",
      description: "Balero rígido",
      link: null,
      qtyRequested: 5,
      requesterUserId: "tech-1",
    });

    assert.equal(req.qtyReserved, 2);
    assert.equal(req.status, "EN_ALMACEN");
    assert.equal(partRequestIssueable(req), 2);
    assert.equal(partRequestShortfall(req), 3);
    assert.ok(state.upsertedRequirement);
    assert.equal(state.upsertedRequirement.quantity, 3);
    assert.equal(state.upsertedRequirement.kind, "REFACCION");
    assert.equal(state.caseStatus, "EN_ESPERA_REFACCIONES");
  });

  it("No encontrada en estante: libera apartado, pasa a SOLICITADA y actualiza el requerimiento de Samuel con el faltante total", async () => {
    const { tx, state } = createMockTx({
      part: { id: "part-1", qty: 2, qtyReserved: 0 },
      existingRequirement: {
        id: "req-os-1",
        status: "PENDIENTE",
        quantity: 3,
        shoppingListLine: null,
      },
    });

    const created = await createPartRequestWithReservation(tx, {
      caseId: "case-1",
      companyId: "comp-1",
      inventoryEnabled: true,
      partNumber: "SKF-6205",
      description: "Balero rígido",
      link: null,
      qtyRequested: 5,
      requesterUserId: "tech-1",
    });
    assert.equal(created.qtyReserved, 2);
    assert.equal(state.part?.qtyReserved, 2);

    const released = await releasePartRequestReservationToPurchase(tx, {
      requestId: created.id,
      companyId: "comp-1",
      version: created.version,
      actorUserId: "almacen-1",
    });

    assert.equal(released.releasedQty, 2);
    assert.equal(released.shortfall, 5);
    assert.equal(released.status, "SOLICITADA");
    assert.equal(state.part?.qtyReserved, 0);
    assert.equal(state.updatedRequirement?.quantity, 5);
    assert.equal(state.caseStatus, "EN_ESPERA_REFACCIONES");
  });

  it("resuelve partidas de un paquete de compra pendientes de ingresar a almacén", () => {
    const partRequestsById = new Map([
      [
        "pr-a",
        {
          id: "pr-a",
          version: 2,
          caseId: "case-1",
          partNumber: "IGBT-100",
          description: "Módulo IGBT",
          qtyRequested: 5,
          qtyReserved: 2,
          qtyReceived: 0,
          qtyIssued: 0,
        },
      ],
      [
        "pr-b",
        {
          id: "pr-b",
          version: 1,
          caseId: "case-2",
          partNumber: "CAP-470",
          description: "Capacitor 470uF",
          qtyRequested: 4,
          qtyReserved: 0,
          qtyReceived: 4,
          qtyIssued: 0,
        },
      ],
    ]);

    const result = resolvePendingPartReceivesForPurchase({
      lines: [
        {
          id: "line-1",
          partNumber: "IGBT-100",
          description: "Módulo IGBT",
          quantity: 3,
          sourceType: "OS",
          sourceId: "pr-a",
        },
        {
          id: "line-2",
          partNumber: "CAP-470",
          description: "Capacitor 470uF",
          quantity: 4,
          sourceType: "OS",
          sourceId: "pr-b",
        },
      ],
      partRequestsById,
    });

    assert.equal(result.lines.length, 1);
    assert.equal(result.lines[0]?.partRequestId, "pr-a");
    assert.equal(result.lines[0]?.qtyToReceive, 3);
    assert.deepEqual(result.aggregatedByRequest, [
      { requestId: "pr-a", version: 2, qtyToReceive: 3 },
    ]);
  });
});
