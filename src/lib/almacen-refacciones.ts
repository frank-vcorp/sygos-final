import { prisma } from "@/lib/db";
import { formatUbicacion } from "@/lib/inventory-location";
import {
  partRequestIssueable,
  partRequestShortfall,
  resolvePendingPartReceivesForPurchase,
} from "@/lib/part-inventory";
import { equipmentDetailHref, equipmentIdentificationLabel } from "@/lib/requirement-display";
import { syncPendingPartRequestRequirements } from "@/lib/requirement-list-enrichment";

const CLOSED_CASES = ["VALIDADO", "TERMINADA", "SIN_REPARACION"] as const;

export function formatPartShelfLocation(
  part:
    | {
        rack: string;
        nivel: string;
        catalogLine?: number | null;
        catalogNumero?: string | null;
      }
    | null
    | undefined,
): string {
  if (!part) return "Sin ubicación en catálogo";
  const base = formatUbicacion(part.rack, part.nivel);
  const line = part.catalogLine && part.catalogLine > 0 ? `Línea ${part.catalogLine}` : "";
  const num = part.catalogNumero?.trim() ? `Núm. ${part.catalogNumero.trim()}` : "";
  const parts = [base, line, num].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Sin ubicación asignada";
}

export function formatAlmacenPartialSupplyBadge(row: {
  qtyRequested: number;
  qtyReserved: number;
  qtyReceived: number;
  qtyIssued: number;
}): string | null {
  const issueable = partRequestIssueable(row);
  const shortfall = partRequestShortfall(row);
  if (issueable <= 0 || shortfall <= 0) return null;
  return `Parcial: ${issueable} en almacén de ${row.qtyRequested} solicitadas (${shortfall} pendientes de compra)`;
}

export type SamuelFollowUpStage = "PENDIENTE_SAMUEL" | "EN_LISTA" | "COMPRADA";

export function describeSamuelFollowUpState(input: {
  requirement: {
    status: string;
    purchaseId?: string | null;
    shoppingList?: { folio: string; supplier?: { name: string } | null } | null;
    purchase?: { folio: string } | null;
  } | null;
  slaDueAt?: Date | null;
  nowMs?: number;
}): {
  label: string;
  tone: "neutral" | "ok" | "warn" | "danger";
  stage: SamuelFollowUpStage;
} {
  const req = input.requirement;
  const now = input.nowMs ?? Date.now();
  const overdue = input.slaDueAt != null && input.slaDueAt.getTime() < now;

  if (req && (req.status === "COMPRADO" || req.status === "ATENDIDO" || req.purchase != null || req.purchaseId != null)) {
    const folio = req.purchase?.folio ?? "Compra";
    return {
      label: `Comprada (${folio}) · Por llegar`,
      tone: "ok",
      stage: "COMPRADA",
    };
  }

  if (req && req.status === "EN_LISTA") {
    const listFolio = req.shoppingList?.folio;
    const supplierName = req.shoppingList?.supplier?.name;
    const detail = [listFolio, supplierName].filter(Boolean).join(" · ");
    return {
      label: detail ? `En lista de compras (${detail})` : "En lista de compras",
      tone: "neutral",
      stage: "EN_LISTA",
    };
  }

  return {
    label: overdue ? "Pendiente con Samuel · SLA vencido" : "Pendiente con Samuel",
    tone: overdue ? "danger" : "warn",
    stage: "PENDIENTE_SAMUEL",
  };
}

export type AlmacenPorSurtirRow = {
  id: string;
  version: number;
  caseId: string;
  partNumber: string;
  description: string;
  ubicacionLabel: string;
  qtyRequested: number;
  qtyReserved: number;
  qtyReceived: number;
  qtyIssued: number;
  issueable: number;
  shortfall: number;
  partialWarningBadge: string | null;
  diagLabel: string;
  diagHref: string | null;
  osLabel: string;
  osHref: string | null;
  equipmentLabel: string;
  equipmentHref: string | null;
  technicianName: string;
  slaDueAt: Date | null;
};

export type AlmacenPurchasePackageLineRow = {
  lineId: string;
  partRequestId: string;
  version: number;
  partNumber: string;
  description: string;
  purchasedQty: number;
  qtyToReceive: number;
  diagLabel: string;
  diagHref: string | null;
  osLabel: string;
  osHref: string | null;
  equipmentLabel: string;
  equipmentHref: string | null;
  technicianName: string;
  slaDueAt: Date | null;
};

export type AlmacenPurchasePackageGroup = {
  purchaseId: string;
  folio: string;
  supplierName: string;
  shoppingListFolio: string | null;
  purchaseDate: Date;
  lines: AlmacenPurchasePackageLineRow[];
  totalUnitsToReceive: number;
};

export type AlmacenPendienteSamuelRow = {
  id: string;
  partNumber: string;
  description: string;
  shortfall: number;
  qtyRequested: number;
  qtyInWarehouse: number;
  diagLabel: string;
  diagHref: string | null;
  osLabel: string;
  osHref: string | null;
  equipmentLabel: string;
  equipmentHref: string | null;
  requesterName: string;
  samuelState: {
    label: string;
    tone: "neutral" | "ok" | "warn" | "danger";
    stage: SamuelFollowUpStage;
  };
  slaDueAt: Date | null;
};

export type AlmacenRefaccionesPanelData = {
  porSurtir: AlmacenPorSurtirRow[];
  paquetesPorIngresar: AlmacenPurchasePackageGroup[];
  pendientesSamuel: AlmacenPendienteSamuelRow[];
};

export async function loadAlmacenRefaccionesPanelData(companyId: string): Promise<AlmacenRefaccionesPanelData> {
  await syncPendingPartRequestRequirements(companyId);

  const openRequests = await prisma.partRequest.findMany({
    where: {
      companyId,
      case: { status: { notIn: [...CLOSED_CASES] } },
    },
    include: {
      part: true,
      presolicitud: { select: { id: true, diagnosisCaseId: true } },
      case: {
        include: {
          equipment: true,
          assignee: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const activeRequests = openRequests.filter((row) => row.qtyIssued < row.qtyRequested);
  if (activeRequests.length === 0) {
    return {
      porSurtir: [],
      paquetesPorIngresar: [],
      pendientesSamuel: [],
    };
  }

  const spawnedFromIds = [
    ...new Set(
      activeRequests
        .map((row) => row.case.spawnedFromId ?? row.presolicitud?.diagnosisCaseId ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [diagnoses, requirements] = await Promise.all([
    spawnedFromIds.length > 0
      ? prisma.technicalCase.findMany({
          where: { id: { in: spawnedFromIds } },
          select: { id: true, folio: true },
        })
      : Promise.resolve([]),
    prisma.requirement.findMany({
      where: {
        companyId,
        OR: [
          { sourceType: "OS", sourceId: { in: activeRequests.map((r) => r.id) } },
          ...(activeRequests.some((r) => r.presolicitud?.id)
            ? [
                {
                  sourceType: "DX",
                  sourceId: {
                    in: activeRequests
                      .map((r) => r.presolicitud?.id)
                      .filter((id): id is string => Boolean(id)),
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        shoppingList: { include: { supplier: { select: { id: true, name: true } } } },
        purchase: {
          include: {
            supplier: { select: { id: true, name: true } },
            shoppingList: { select: { id: true, folio: true } },
          },
        },
      },
    }),
  ]);

  const requesterUserIds = [...new Set(requirements.map((req) => req.requesterUserId))];
  const requesterUsers =
    requesterUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: requesterUserIds } },
          select: { id: true, name: true },
        })
      : [];
  const userNameById = new Map(requesterUsers.map((u) => [u.id, u.name]));

  const diagnosisById = new Map(diagnoses.map((d) => [d.id, d]));
  const dxPresolicitudToPartRequestId = new Map<string, string>();
  for (const pr of activeRequests) {
    if (pr.presolicitud?.id) {
      dxPresolicitudToPartRequestId.set(pr.presolicitud.id, pr.id);
    }
  }

  const requirementByPartRequestId = new Map<string, (typeof requirements)[number]>();
  for (const req of requirements) {
    if (req.sourceType === "OS" && req.sourceId) {
      requirementByPartRequestId.set(req.sourceId, req);
    } else if (req.sourceType === "DX" && req.sourceId) {
      const prId = dxPresolicitudToPartRequestId.get(req.sourceId);
      if (prId && !requirementByPartRequestId.has(prId)) {
        requirementByPartRequestId.set(prId, req);
      }
    }
  }

  function buildCaseContext(pr: (typeof activeRequests)[number]) {
    const dxId = pr.case.spawnedFromId ?? pr.presolicitud?.diagnosisCaseId ?? null;
    const dx = dxId ? diagnosisById.get(dxId) ?? null : null;
    const req = requirementByPartRequestId.get(pr.id);
    const requesterName = req ? userNameById.get(req.requesterUserId) ?? null : null;
    const technicianName = pr.case.assignee?.name ?? requesterName ?? "Sin asignar";
    return {
      diagLabel: dx?.folio ?? "—",
      diagHref: dx ? `/operacion/${dx.id}` : null,
      osLabel: pr.case.folio,
      osHref: `/operacion/${pr.case.id}`,
      equipmentLabel: equipmentIdentificationLabel(pr.case.equipment),
      equipmentHref: equipmentDetailHref(pr.case.equipment),
      technicianName,
      slaDueAt: pr.case.slaDueAt ?? pr.createdAt,
    };
  }

  const porSurtir: AlmacenPorSurtirRow[] = activeRequests
    .filter((pr) => partRequestIssueable(pr) > 0)
    .map((pr) => {
      const ctx = buildCaseContext(pr);
      const issueable = partRequestIssueable(pr);
      const shortfall = partRequestShortfall(pr);
      return {
        id: pr.id,
        version: pr.version,
        caseId: pr.caseId,
        partNumber: pr.partNumber,
        description: pr.description,
        ubicacionLabel: formatPartShelfLocation(pr.part),
        qtyRequested: pr.qtyRequested,
        qtyReserved: pr.qtyReserved,
        qtyReceived: pr.qtyReceived,
        qtyIssued: pr.qtyIssued,
        issueable,
        shortfall,
        partialWarningBadge: formatAlmacenPartialSupplyBadge(pr),
        ...ctx,
      };
    })
    .sort((a, b) => (a.slaDueAt?.getTime() ?? Infinity) - (b.slaDueAt?.getTime() ?? Infinity));

  const requestsWithShortfall = activeRequests.filter((pr) => partRequestShortfall(pr) > 0);
  const shortfallById = new Map(requestsWithShortfall.map((pr) => [pr.id, pr]));

  const candidatePurchaseIds = new Set<string>();
  for (const req of requirements) {
    if (req.purchaseId) candidatePurchaseIds.add(req.purchaseId);
  }

  const purchases =
    requestsWithShortfall.length > 0
      ? await prisma.purchase.findMany({
          where: {
            companyId,
            status: { notIn: ["CANCELADA", "RECHAZADA", "ELIMINADA"] },
            OR: [
              ...(candidatePurchaseIds.size > 0 ? [{ id: { in: [...candidatePurchaseIds] } }] : []),
              {
                lines: {
                  some: {
                    sourceType: "OS",
                    sourceId: { in: requestsWithShortfall.map((pr) => pr.id) },
                  },
                },
              },
            ],
          },
          include: {
            supplier: { select: { id: true, name: true } },
            shoppingList: { select: { id: true, folio: true } },
            lines: {
              include: {
                requirement: { select: { sourceType: true, sourceId: true } },
              },
              orderBy: { createdAt: "asc" },
            },
            requirements: {
              select: {
                id: true,
                partNumber: true,
                description: true,
                quantity: true,
                sourceType: true,
                sourceId: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

  const paquetesPorIngresar: AlmacenPurchasePackageGroup[] = [];
  for (const purchase of purchases) {
    const resolved = resolvePendingPartReceivesForPurchase({
      lines: purchase.lines,
      requirements: purchase.requirements,
      partRequestsById: shortfallById,
      dxPresolicitudToPartRequestId,
    });
    if (resolved.lines.length === 0) continue;

    const lines: AlmacenPurchasePackageLineRow[] = resolved.lines.map((line) => {
      const pr = shortfallById.get(line.partRequestId)!;
      const ctx = buildCaseContext(pr);
      return {
        lineId: line.lineId,
        partRequestId: line.partRequestId,
        version: line.version,
        partNumber: line.partNumber,
        description: line.description,
        purchasedQty: line.purchasedQty,
        qtyToReceive: line.qtyToReceive,
        ...ctx,
      };
    });

    paquetesPorIngresar.push({
      purchaseId: purchase.id,
      folio: purchase.folio,
      supplierName: purchase.supplier?.name ?? "Sin proveedor",
      shoppingListFolio: purchase.shoppingList?.folio ?? null,
      purchaseDate: purchase.purchaseDate ?? purchase.createdAt,
      lines,
      totalUnitsToReceive: resolved.aggregatedByRequest.reduce((sum, item) => sum + item.qtyToReceive, 0),
    });
  }

  const stagePriority: Record<SamuelFollowUpStage, number> = {
    PENDIENTE_SAMUEL: 0,
    EN_LISTA: 1,
    COMPRADA: 2,
  };

  const nowMs = Date.now();
  const pendientesSamuel: AlmacenPendienteSamuelRow[] = requestsWithShortfall
    .map((pr) => {
      const ctx = buildCaseContext(pr);
      const req = requirementByPartRequestId.get(pr.id) ?? null;
      const samuelState = describeSamuelFollowUpState({
        requirement: req,
        slaDueAt: ctx.slaDueAt,
        nowMs,
      });
      return {
        id: pr.id,
        partNumber: pr.partNumber,
        description: pr.description,
        shortfall: partRequestShortfall(pr),
        qtyRequested: pr.qtyRequested,
        qtyInWarehouse: Math.max(0, partRequestIssueable(pr)),
        diagLabel: ctx.diagLabel,
        diagHref: ctx.diagHref,
        osLabel: ctx.osLabel,
        osHref: ctx.osHref,
        equipmentLabel: ctx.equipmentLabel,
        equipmentHref: ctx.equipmentHref,
        requesterName: ctx.technicianName,
        samuelState,
        slaDueAt: ctx.slaDueAt,
      };
    })
    .sort((a, b) => {
      const stageDiff = stagePriority[a.samuelState.stage] - stagePriority[b.samuelState.stage];
      if (stageDiff !== 0) return stageDiff;
      return (a.slaDueAt?.getTime() ?? Infinity) - (b.slaDueAt?.getTime() ?? Infinity);
    });

  return {
    porSurtir,
    paquetesPorIngresar,
    pendientesSamuel,
  };
}
