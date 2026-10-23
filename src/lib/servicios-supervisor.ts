import { prisma } from "@/lib/db";
import {
  administrativeStatus,
  equipmentDetailHref,
  formatEquipmentBandejaLabel,
  physicalStatusFromCustody,
  technicalStatusFromCase,
  type StackedStatus,
} from "@/lib/servicios-bandeja";
import { compareBySla } from "@/lib/sla";
import { parseServiciosDateBoundary, SERVICIO_TIPO_PARAM, type ServicioTipoParam } from "@/lib/servicios-catalog";
import type { AttentionType } from "@/lib/priorities";

export const CLOSED_CASE = ["VALIDADO", "TERMINADA", "SIN_REPARACION"] as const;
export const HISTORIAL_CASE = [...CLOSED_CASE, "CANCELADA"] as const;
/** Tras concluir diagnóstico en SYSTRON el técnico ya no ejecuta; sigue visible para gerencia en activos del taller. */
export const TECHNICIAN_HANDOFF_CASE = ["PENDIENTE_VALIDACION", ...CLOSED_CASE] as const;
export const TECHNICIAN_HISTORIAL_CASE = [...HISTORIAL_CASE, "PENDIENTE_VALIDACION"] as const;

/** Casos visibles en bandejas activas: operación abierta o cierre técnico con pendiente comercial. */
export function openOperationCaseWhere() {
  return {
    OR: [
      { status: { notIn: [...CLOSED_CASE] } },
      { status: "VALIDADO", quotePending: true },
      {
        status: "VALIDADO",
        warrantyDecision: "NO_PROCEDENTE",
        commercialDecision: null,
      },
    ],
  };
}

type ListScope = {
  assigneeUserId?: string;
  /** Cartera de ventas: solo equipos de clientes asignados al vendedor. */
  clientOwnerUserId?: string;
  tipo?: ServicioTipoParam | null;
  desde?: string;
  hasta?: string;
};

function clientOwnerScope(userId: string) {
  return { equipment: { client: { ownerUserId: userId, isSystem: false } } };
}

function technicianCaseScope(userId: string) {
  return { OR: [{ assigneeUserId: userId }, { finishedByUserId: userId }] };
}

/** Bandeja activa del técnico: solo asignaciones con trabajo pendiente de ejecución. */
export function technicianActiveCaseWhere(userId: string) {
  return {
    assigneeUserId: userId,
    status: { notIn: [...TECHNICIAN_HANDOFF_CASE] },
  };
}

function caseSearchWhere(q: string) {
  return {
    OR: [
      { folio: { contains: q } },
      { equipment: { folio: { contains: q } } },
      { equipment: { client: { name: { contains: q } } } },
      { attention: { reportedFault: { contains: q } } },
    ],
  };
}

function createdAtRange(desde?: string, hasta?: string) {
  const from = parseServiciosDateBoundary(desde, false);
  const to = parseServiciosDateBoundary(hasta, true);
  if (!from && !to) return {};
  return { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
}

function updatedAtRange(desde?: string, hasta?: string) {
  const from = parseServiciosDateBoundary(desde, false);
  const to = parseServiciosDateBoundary(hasta, true);
  if (!from && !to) return {};
  return { updatedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
}

type CaseRecord = {
  id: string;
  folio: string;
  kind: string;
  status: string;
  spawnedFromId: string | null;
  slaDueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  validatedAt: Date | null;
  externalSupplierId: string | null;
  quotePending: boolean;
  warrantyDecision: string | null;
  attentionId: string;
  equipmentId: string;
  equipment: {
    id: string;
    kind: string;
    folio: string;
    typeName: string | null;
    brandName: string | null;
    model: string;
    custody: string;
    client: { name: string };
  };
  attention: {
    attentionType: string;
    slaStartedAt: Date | null;
    sellerUserId: string | null;
  };
  assignee: { name: string } | null;
};

export type ServicioBandejaRow = {
  kind: "servicio";
  id: string;
  equipmentId: string;
  equipmentHref: string;
  equipmentLabel: string;
  diagnosisFolio: string | null;
  diagnosisHref: string | null;
  osFolio: string | null;
  osHref: string | null;
  clientName: string;
  technical: StackedStatus;
  administrative: StackedStatus;
  physical: StackedStatus;
  sellerName: string | null;
  technicianName: string | null;
  slaDueAt: Date | null;
  slaStartedAt: Date | null;
  createdAt: Date;
  closedAt: Date | null;
  /** Estatus técnico crudo del caso principal (filtros historial). */
  primaryStatus: string;
};

export type CancelledServicioBandejaRow = {
  kind: "cancelado";
  id: string;
  equipmentId: string;
  equipmentHref: string;
  equipmentLabel: string;
  clientName: string;
  closedAt: Date;
  createdAt: Date;
};

export type SupervisorServicioRow = ServicioBandejaRow | CancelledServicioBandejaRow;

export function servicioRowHighlight(row: SupervisorServicioRow, now = Date.now()) {
  if (row.kind === "cancelado") {
    return { wrapClass: "", markers: [] as string[] };
  }
  const overdue = row.slaDueAt != null && row.slaDueAt.getTime() < now;
  const refacciones = row.primaryStatus === "EN_ESPERA_REFACCIONES";
  const markers: string[] = [];
  if (overdue) markers.push("Vencido");
  if (refacciones) markers.push("Refacciones");
  let wrapClass = "";
  if (overdue) {
    wrapClass = "bg-gradient-to-r from-[#fff7ed] to-white ring-1 ring-inset ring-[#fdba74]/80";
  } else if (refacciones) {
    wrapClass = "bg-gradient-to-r from-[#eff6ff] to-white ring-1 ring-inset ring-[#93c5fd]/70";
  }
  return { wrapClass, markers };
}

function pickQuoteForAttention(
  attentionId: string,
  caseIds: string[],
  equipmentId: string,
  quotes: Array<{ technicalCaseId: string | null; equipmentId: string | null; status: string; updatedAt: Date }>,
) {
  const linked = quotes.filter((q) => q.technicalCaseId && caseIds.includes(q.technicalCaseId));
  if (linked.length > 0) {
    return linked.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
  }
  const byEquipment = quotes.filter((q) => q.equipmentId === equipmentId);
  return byEquipment.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
}

function buildServicioRow(
  attentionId: string,
  cases: CaseRecord[],
  quoteStatus: string | null,
  sellerName: string | null,
): ServicioBandejaRow {
  const os =
    cases.find((c) => c.kind === "OS")
    ?? null;
  const diagnosis =
    cases.find((c) => c.kind === "DIAGNOSTICO")
    ?? (os?.spawnedFromId ? cases.find((c) => c.id === os.spawnedFromId) : null)
    ?? null;
  const primary = os ?? diagnosis ?? cases[0];
  const equipment = primary.equipment;
  const technicalSource = os ?? diagnosis ?? primary;

  const diagnosisFolio = diagnosis?.folio ?? null;
  const diagnosisHref = diagnosis && !os ? `/operacion/${diagnosis.id}` : null;
  const osFolio = os?.folio ?? null;
  const osHref = os ? `/operacion/${os.id}` : null;

  let technicianName: string | null = null;
  const techCase = os ?? diagnosis;
  if (techCase?.externalSupplierId) technicianName = "Proveedor externo";
  else if (techCase?.assignee?.name) technicianName = techCase.assignee.name;

  const quotePending = Boolean((diagnosis ?? primary).quotePending || (os?.quotePending ?? false));

  return {
    kind: "servicio",
    id: attentionId,
    equipmentId: equipment.id,
    equipmentHref: equipmentDetailHref(equipment.kind, equipment.id),
    equipmentLabel: formatEquipmentBandejaLabel(equipment),
    diagnosisFolio,
    diagnosisHref,
    osFolio,
    osHref,
    clientName: equipment.client.name,
    technical: technicalStatusFromCase(technicalSource.status),
    administrative: administrativeStatus({
      attentionType: primary.attention.attentionType,
      quoteStatus,
      quotePending,
      warrantyDecision: (diagnosis ?? primary).warrantyDecision,
    }),
    physical: physicalStatusFromCustody(equipment.custody),
    sellerName,
    technicianName,
    slaDueAt: primary.slaDueAt,
    slaStartedAt: primary.attention.slaStartedAt,
    createdAt: primary.createdAt,
    closedAt: primary.validatedAt ?? primary.updatedAt,
    primaryStatus: technicalSource.status,
  };
}

function groupCasesByAttention(cases: CaseRecord[]) {
  const map = new Map<string, CaseRecord[]>();
  for (const row of cases) {
    const list = map.get(row.attentionId) ?? [];
    list.push(row);
    map.set(row.attentionId, list);
  }
  return map;
}

function groupCasesByEquipment(cases: CaseRecord[]) {
  const map = new Map<string, CaseRecord[]>();
  for (const row of cases) {
    const list = map.get(row.equipmentId) ?? [];
    list.push(row);
    map.set(row.equipmentId, list);
  }
  return map;
}

const caseInclude = {
  equipment: { include: { client: true } },
  attention: { select: { priorityName: true, slaStartedAt: true, attentionType: true, sellerUserId: true } },
  assignee: { select: { name: true } },
} as const;

async function attachParentDiagnoses(companyId: string, cases: CaseRecord[]): Promise<CaseRecord[]> {
  const existing = new Set(cases.map((c) => c.id));
  const parentIds = [
    ...new Set(
      cases
        .filter((c) => c.kind === "OS" && c.spawnedFromId && !existing.has(c.spawnedFromId))
        .map((c) => c.spawnedFromId as string),
    ),
  ];
  if (parentIds.length === 0) return cases;
  const parents = await prisma.technicalCase.findMany({
    where: { id: { in: parentIds }, serviceCompanyId: companyId },
    include: caseInclude,
  });
  return [...cases, ...(parents as CaseRecord[])];
}

async function mapCasesToBandejaRows(companyId: string, cases: CaseRecord[]): Promise<ServicioBandejaRow[]> {
  if (cases.length === 0) return [];

  const casesWithParents = await attachParentDiagnoses(companyId, cases);
  const caseIds = casesWithParents.map((c) => c.id);
  const equipmentIds = [...new Set(casesWithParents.map((c) => c.equipmentId))];
  const sellerIds = [
    ...new Set(casesWithParents.map((c) => c.attention.sellerUserId).filter((id): id is string => Boolean(id))),
  ];

  const [quotes, sellers] = await Promise.all([
    prisma.quote.findMany({
      where: {
        companyId,
        OR: [{ technicalCaseId: { in: caseIds } }, { equipmentId: { in: equipmentIds } }],
      },
      select: { technicalCaseId: true, equipmentId: true, status: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    sellerIds.length
      ? prisma.user.findMany({ where: { id: { in: sellerIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const sellerMap = new Map(sellers.map((u) => [u.id, u.name]));

  const byEquipment = groupCasesByEquipment(casesWithParents);
  const rows: ServicioBandejaRow[] = [];

  for (const equipmentCases of byEquipment.values()) {
    const byAttention = groupCasesByAttention(equipmentCases);
    for (const [attentionId, attentionCases] of byAttention) {
      const primary = attentionCases[0];
      const quote = pickQuoteForAttention(
        attentionId,
        attentionCases.map((c) => c.id),
        primary.equipmentId,
        quotes,
      );
      const sellerName = primary.attention.sellerUserId
        ? sellerMap.get(primary.attention.sellerUserId) ?? null
        : null;
      rows.push(buildServicioRow(attentionId, attentionCases, quote?.status ?? null, sellerName));
    }
  }

  return rows;
}

/** Episodios de servicio ligados a documentos de cobranza (caso u equipo). */
export async function listServiciosForBillingLinks(
  companyId: string,
  links: Array<{ technicalCaseId: string | null; equipmentId: string | null }>,
): Promise<ServicioBandejaRow[]> {
  const caseIds = [...new Set(links.map((link) => link.technicalCaseId).filter((id): id is string => Boolean(id)))];
  const equipmentIds = [...new Set(links.map((link) => link.equipmentId).filter((id): id is string => Boolean(id)))];
  const orFilters = [
    ...(caseIds.length ? [{ id: { in: caseIds } }] : []),
    ...(equipmentIds.length ? [{ equipmentId: { in: equipmentIds } }] : []),
  ];
  if (orFilters.length === 0) return [];

  const cases = await prisma.technicalCase.findMany({
    where: { serviceCompanyId: companyId, OR: orFilters },
    include: caseInclude,
    take: 200,
  });
  const rows = await mapCasesToBandejaRows(companyId, cases as CaseRecord[]);
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function listActiveServicios(
  companyId: string,
  query: string,
  options?: ListScope,
): Promise<SupervisorServicioRow[]> {
  const tipo = options?.tipo ?? null;
  const attentionType = tipo ? (SERVICIO_TIPO_PARAM[tipo] as AttentionType) : null;
  const q = query.trim();
  const technicianId = options?.assigneeUserId;
  const clientOwnerUserId = options?.clientOwnerUserId;

  const activeFilters = [
    { serviceCompanyId: companyId },
    technicianId ? technicianActiveCaseWhere(technicianId) : openOperationCaseWhere(),
    ...(clientOwnerUserId ? [clientOwnerScope(clientOwnerUserId)] : []),
    ...(attentionType ? [{ attention: { attentionType } }] : []),
    createdAtRange(options?.desde, options?.hasta),
    ...(q ? [caseSearchWhere(q)] : []),
  ].filter((part) => Object.keys(part).length > 0);

  const cases = await prisma.technicalCase.findMany({
    where: { AND: activeFilters },
    include: caseInclude,
    take: 200,
  });

  const rows = await mapCasesToBandejaRows(companyId, cases as CaseRecord[]);
  return rows.sort((a, b) =>
    compareBySla(
      { slaDueAt: a.slaDueAt, slaStartedAt: a.slaStartedAt, createdAt: a.createdAt },
      { slaDueAt: b.slaDueAt, slaStartedAt: b.slaStartedAt, createdAt: b.createdAt },
    ),
  );
}

export async function listHistorialServicios(
  companyId: string,
  query: string,
  options?: ListScope & { status?: string | null },
): Promise<SupervisorServicioRow[]> {
  const tipo = options?.tipo ?? null;
  const attentionType = tipo ? (SERVICIO_TIPO_PARAM[tipo] as AttentionType) : null;
  const q = query.trim();
  const technicianId = options?.assigneeUserId;
  const clientOwnerUserId = options?.clientOwnerUserId;
  const historialStatuses = technicianId ? TECHNICIAN_HISTORIAL_CASE : HISTORIAL_CASE;
  const statusFilter =
    options?.status && options.status !== "todos" && (historialStatuses as readonly string[]).includes(options.status)
      ? options.status
      : null;

  const historialFilters = [
    { serviceCompanyId: companyId },
    { status: statusFilter ? statusFilter : { in: [...historialStatuses] } },
    ...(technicianId ? [technicianCaseScope(technicianId)] : []),
    ...(clientOwnerUserId ? [clientOwnerScope(clientOwnerUserId)] : []),
    ...(attentionType ? [{ attention: { attentionType } }] : []),
    updatedAtRange(options?.desde, options?.hasta),
    ...(q ? [caseSearchWhere(q)] : []),
  ].filter((part) => Object.keys(part).length > 0);

  const cases = await prisma.technicalCase.findMany({
    where: { AND: historialFilters },
    include: caseInclude,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const cancelledAttentions =
    technicianId || (statusFilter && statusFilter !== "CANCELADA")
      ? []
      : await prisma.attention.findMany({
          where: {
            serviceCompanyId: companyId,
            status: "CANCELADA",
            ...(attentionType ? { attentionType } : {}),
            ...(clientOwnerUserId
              ? { equipment: { client: { ownerUserId: clientOwnerUserId, isSystem: false } } }
              : {}),
            ...updatedAtRange(options?.desde, options?.hasta),
            technicalCases: { none: {} },
            ...(q
              ? {
                  OR: [
                    { equipment: { folio: { contains: q } } },
                    { equipment: { client: { name: { contains: q } } } },
                    { reportedFault: { contains: q } },
                  ],
                }
              : {}),
          },
          include: { equipment: { include: { client: true } } },
          orderBy: { updatedAt: "desc" },
          take: 80,
        });

  const serviceRows = await mapCasesToBandejaRows(companyId, cases as CaseRecord[]);
  const cancelledRows: CancelledServicioBandejaRow[] = cancelledAttentions.map((row) => ({
    kind: "cancelado",
    id: row.id,
    equipmentId: row.equipment.id,
    equipmentHref: equipmentDetailHref(row.equipment.kind, row.equipment.id),
    equipmentLabel: formatEquipmentBandejaLabel(row.equipment),
    clientName: row.equipment.client.name,
    closedAt: row.updatedAt,
    createdAt: row.createdAt,
  }));

  return [...serviceRows, ...cancelledRows].sort(
    (a, b) => (b.closedAt ?? b.createdAt).getTime() - (a.closedAt ?? a.createdAt).getTime(),
  );
}

export async function listActiveServiciosByTipo(
  companyId: string,
  tipo: ServicioTipoParam,
  query: string,
  options?: { assigneeUserId?: string },
): Promise<SupervisorServicioRow[]> {
  return listActiveServicios(companyId, query, { ...options, tipo });
}

/** @deprecated use listActiveServicios */
export async function listSupervisorActiveServicios(
  companyId: string,
  tipo: ServicioTipoParam,
  query: string,
): Promise<SupervisorServicioRow[]> {
  return listActiveServiciosByTipo(companyId, tipo, query);
}
