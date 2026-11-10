import { prisma } from "@/lib/db";
import { displayCompanyCaseFolio, ensureOriginCompanyServiceNumbers, revealAuthorizedIntercompanyOrders, serviceCycleNumberFromFolio } from "@/lib/folios";
import { serviceClientForCompany } from "@/lib/intercompany-client";
import { alignIntercompanyWorkshopQuoteClients } from "@/lib/quotes";
import { linesForTotal, money, quoteTotals } from "@/lib/money";
import {
  administrativeStatus,
  equipmentDetailHref,
  formatEquipmentBandejaLabel,
  physicalStatusFromCustody,
  technicalStatusFromCase,
  type StackedStatus,
} from "@/lib/servicios-bandeja";
import { compareBySla } from "@/lib/sla";
import { isReparacionExpressAttentionType, type AttentionType } from "@/lib/priorities";
import { parseServiciosDateBoundary, SERVICIO_TIPO_PARAM, type ServicioTipoParam } from "@/lib/servicios-catalog";

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

type ReservedOsStubPick = {
  kind: string;
  spawnedFromId: string | null;
  quotePending: boolean;
  attention: { attentionType: string };
};

/** OS reservada del ciclo SRV (DX-n / OS-n): invisible en UI hasta autorizar reparación (mirror assertRepairOsExecutable). */
export function isHiddenReservedOsStubInDiagnosisCycle(
  caseRow: ReservedOsStubPick,
  siblingCases?: Array<{ id: string; kind: string }>,
): boolean {
  if (caseRow.kind !== "OS" || !caseRow.spawnedFromId || !caseRow.quotePending) return false;
  if (caseRow.attention.attentionType !== "DIAGNOSTICO") return false;
  if (siblingCases) {
    const parent = siblingCases.find((row) => row.id === caseRow.spawnedFromId);
    if (parent && parent.kind !== "DIAGNOSTICO") return false;
  }
  return true;
}

/** Excluye filas de OS reservada en consultas Prisma (cola operación / bandejas activas). */
export function hiddenReservedOsStubCaseWhere() {
  return {
    NOT: {
      AND: [
        { kind: "OS" },
        { spawnedFromId: { not: null } },
        { quotePending: true },
        { attention: { attentionType: "DIAGNOSTICO" } },
      ],
    },
  };
}

type ListScope = {
  assigneeUserId?: string;
  /** Cartera de ventas: solo equipos de clientes asignados al vendedor. */
  clientOwnerUserId?: string;
  tipo?: ServicioTipoParam | null;
  equipmentKind?: "EQUI" | "MOT" | null;
  desde?: string;
  hasta?: string;
  /** Systron: incluye motores cuyo caso vive en Servomotores pero nacieron aquí. */
  originMotors?: boolean;
  /** Systron: gerente, supervisor y técnico no ven motores. */
  hideMotors?: boolean;
};

/** Alcance de bandeja: taller de la empresa, o motores de origen cuando el caso lo ejecuta la otra. */
export function servicioCompanyScope(
  companyId: string,
  options?: { equipmentKind?: "EQUI" | "MOT" | null; originMotors?: boolean; hideMotors?: boolean },
) {
  const kind = options?.equipmentKind ?? null;
  const hideMotors = options?.hideMotors === true;
  const originMotors = options?.originMotors === true && !hideMotors;
  if (hideMotors || kind === "EQUI") {
    return { serviceCompanyId: companyId, equipment: { kind: "EQUI" as const } };
  }
  if (kind === "MOT") {
    if (originMotors) return { equipment: { kind: "MOT" as const, originCompanyId: companyId } };
    return { serviceCompanyId: companyId, equipment: { kind: "MOT" as const } };
  }
  if (originMotors) {
    return {
      OR: [
        { serviceCompanyId: companyId, equipment: { kind: { not: "MOT" } } },
        { equipment: { kind: "MOT" as const, originCompanyId: companyId } },
      ],
    };
  }
  return { serviceCompanyId: companyId };
}

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

function caseSearchWhere(companyId: string, q: string) {
  const parsed = serviceCycleNumberFromFolio(q.trim().toUpperCase());
  return {
    OR: [
      { folio: { contains: q } },
      ...(parsed != null
        ? [{
            attention: {
              originCompanyId: companyId,
              serviceCompanyId: { not: companyId },
              originServiceNumber: parsed,
            },
          }]
        : []),
      { equipment: { folio: { contains: q } } },
      { equipment: { client: { name: { contains: q } } } },
      { attention: { adminClient: { name: { contains: q } } } },
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
  noRepairAt: Date | null;
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
    client: { id: string; name: string; isSystem: boolean };
  };
  attention: {
    attentionType: string;
    slaStartedAt: Date | null;
    sellerUserId: string | null;
    priorityName: string;
    createdAt: Date;
    originCompanyId: string;
    serviceCompanyId: string;
    serviceNumber: number | null;
    originServiceNumber: number | null;
    adminClient: { id: string; name: string; isSystem: boolean } | null;
  };
  assignee: { name: string } | null;
};

export type ServicioBandejaRow = {
  kind: "servicio";
  id: string;
  equipmentId: string;
  equipmentKind: string;
  equipmentHref: string;
  equipmentLabel: string;
  diagnosisFolio: string | null;
  diagnosisHref: string | null;
  osFolio: string | null;
  osHref: string | null;
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  technical: StackedStatus;
  administrative: StackedStatus;
  physical: StackedStatus;
  sellerName: string | null;
  technicianName: string | null;
  quoteFolio: string | null;
  quoteHref: string | null;
  quoteStatus: string | null;
  quoteSellerUserId: string | null;
  quoteMonto: string;
  slaDueAt: Date | null;
  slaStartedAt: Date | null;
  attentionCreatedAt: Date;
  priorityName: string;
  attentionType: string;
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
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  closedAt: Date;
  createdAt: Date;
  priorityName: string;
};

export type SupervisorServicioRow = ServicioBandejaRow | CancelledServicioBandejaRow;

export function servicioRowHighlight(row: SupervisorServicioRow, now = Date.now()) {
  if (row.kind === "cancelado") {
    return { wrapClass: "", markers: [] as string[] };
  }
  if (isReparacionExpressAttentionType(row.attentionType)) {
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

type QuoteBandejaPick = {
  id: string;
  folio: string;
  technicalCaseId: string | null;
  equipmentId: string | null;
  status: string;
  quoteType: string;
  discountPct: number;
  updatedAt: Date;
  sellerUserId: string | null;
  lines: Array<{ quantity: number; unitPrice: number | null; authorized: boolean }>;
};

function quoteMontoBandejaLabel(quote: QuoteBandejaPick | null): string {
  if (!quote) return "—";
  if (quote.status === "PENDIENTE_COTIZAR") return "Sin precio";
  const totals = quoteTotals(
    linesForTotal(quote.lines, quote.quoteType, quote.status),
    quote.discountPct,
  );
  return totals ? money(totals.total) : "—";
}

/** Prioriza cotización que espera decisión del vendedor sobre borradores más recientes. */
export function pickBestQuoteForBandeja(quotes: QuoteBandejaPick[]): QuoteBandejaPick | null {
  if (quotes.length === 0) return null;
  const rank = (status: string) => {
    if (status === "PENDIENTE_DECISION") return 0;
    if (status === "PENDIENTE_COTIZAR") return 1;
    if (status === "NO_AUTORIZADA") return 2;
    return 3;
  };
  return [...quotes].sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  })[0]!;
}

type QuoteLinkCasePick = { id: string; kind: string; spawnedFromId: string | null };

/** Evita mostrar cotización ligada al OS reservado si la misma atención ya tiene cotización en el DX. */
export function filterQuotesPreferDiagnosisOverReservedOs(
  quotes: QuoteBandejaPick[],
  cases: QuoteLinkCasePick[],
): QuoteBandejaPick[] {
  if (quotes.length <= 1) return quotes;
  const diagnosis = cases.find((row) => row.kind === "DIAGNOSTICO");
  if (!diagnosis) return quotes;
  const reservedOs = cases.find(
    (row) => row.kind === "OS" && row.spawnedFromId === diagnosis.id,
  );
  if (!reservedOs) return quotes;
  const onDiagnosis = quotes.filter((q) => q.technicalCaseId === diagnosis.id);
  if (onDiagnosis.length === 0) return quotes;
  const withoutReservedOs = quotes.filter((q) => q.technicalCaseId !== reservedOs.id);
  return withoutReservedOs.length > 0 ? withoutReservedOs : quotes;
}

export function pickQuoteForAttention(
  _attentionId: string,
  cases: QuoteLinkCasePick[],
  equipmentId: string,
  quotes: QuoteBandejaPick[],
) {
  const caseIds = cases.map((row) => row.id);
  const linked = quotes.filter((q) => q.technicalCaseId && caseIds.includes(q.technicalCaseId));
  if (linked.length > 0) {
    return pickBestQuoteForBandeja(filterQuotesPreferDiagnosisOverReservedOs(linked, cases));
  }
  const byEquipment = quotes.filter((q) => q.equipmentId === equipmentId);
  return pickBestQuoteForBandeja(byEquipment);
}

async function technicalCaseIdsPendingSellerDecision(
  companyId: string,
  clientOwnerUserId?: string,
): Promise<string[]> {
  const rows = await prisma.quote.findMany({
    where: {
      companyId,
      status: "PENDIENTE_DECISION",
      technicalCaseId: { not: null },
      ...(clientOwnerUserId
        ? {
            OR: [
              { sellerUserId: clientOwnerUserId },
              { client: { ownerUserId: clientOwnerUserId, isSystem: false } },
            ],
          }
        : {}),
    },
    select: { technicalCaseId: true },
    take: 200,
  });
  return [
    ...new Set(rows.map((row) => row.technicalCaseId).filter((id): id is string => Boolean(id))),
  ];
}

function buildServicioRow(
  attentionId: string,
  cases: CaseRecord[],
  quote: QuoteBandejaPick | null,
  sellerName: string | null,
  viewingCompanyId: string,
): ServicioBandejaRow {
  const quoteStatus = quote?.status ?? null;
  const siblingPick = cases.map((c) => ({ id: c.id, kind: c.kind }));
  const osRaw = cases.find((c) => c.kind === "OS") ?? null;
  const quoteAuthorizesRepair = Boolean(quoteStatus?.startsWith("AUTORIZADA"));
  const os =
    osRaw && (quoteAuthorizesRepair || !isHiddenReservedOsStubInDiagnosisCycle(osRaw, siblingPick))
      ? osRaw
      : null;
  const diagnosis =
    cases.find((c) => c.kind === "DIAGNOSTICO")
    ?? (osRaw?.spawnedFromId ? cases.find((c) => c.id === osRaw.spawnedFromId) : null)
    ?? null;
  const diagnosisActive =
    diagnosis != null && !(CLOSED_CASE as readonly string[]).includes(diagnosis.status);
  const primary = (diagnosisActive ? diagnosis : null) ?? os ?? diagnosis ?? cases[0];
  const equipment = primary.equipment;
  const technicalSource = diagnosisActive ? diagnosis : (os ?? diagnosis ?? primary);

  const diagnosisFolio = diagnosis
    ? displayCompanyCaseFolio(diagnosis.folio, diagnosis.attention, viewingCompanyId)
    : null;
  const diagnosisHref = diagnosis ? `/operacion/${diagnosis.id}` : null;
  const osFolio = os ? displayCompanyCaseFolio(os.folio, os.attention, viewingCompanyId) : null;
  const osHref = os ? `/operacion/${os.id}` : null;

  let technicianName: string | null = null;
  const techCase = os ?? diagnosis;
  if (techCase?.externalSupplierId) technicianName = "Proveedor externo";
  else if (techCase?.assignee?.name) technicianName = techCase.assignee.name;

  const quotePending = Boolean(
    !((diagnosis ?? primary).noRepairAt && (diagnosis ?? primary).status === "VALIDADO")
    && ((diagnosis ?? primary).quotePending || (os?.quotePending ?? false)),
  );
  const diagnosisNoRepair = Boolean(
    (diagnosis ?? primary).kind === "DIAGNOSTICO"
    && (diagnosis ?? primary).noRepairAt
    && (diagnosis ?? primary).status === "VALIDADO",
  );
  const shownClient = serviceClientForCompany(viewingCompanyId, primary.attention, equipment.client);

  return {
    kind: "servicio",
    id: attentionId,
    equipmentId: equipment.id,
    equipmentKind: equipment.kind,
    equipmentHref: equipmentDetailHref(equipment.kind, equipment.id),
    equipmentLabel: formatEquipmentBandejaLabel(equipment),
    diagnosisFolio,
    diagnosisHref,
    osFolio,
    osHref,
    clientId: shownClient.id,
    clientName: shownClient.name,
    clientIsSystem: shownClient.isSystem,
    technical: technicalStatusFromCase(technicalSource.status),
    administrative: administrativeStatus({
      attentionType: primary.attention.attentionType,
      quoteStatus,
      quotePending,
      warrantyDecision: (diagnosis ?? primary).warrantyDecision,
      diagnosisNoRepair,
    }),
    physical: physicalStatusFromCustody(equipment.custody),
    sellerName,
    technicianName,
    quoteFolio: quote?.folio ?? null,
    quoteHref: quote ? `/cotizaciones/${quote.id}` : null,
    quoteStatus,
    quoteSellerUserId: quote?.sellerUserId ?? null,
    quoteMonto: quoteMontoBandejaLabel(quote),
    slaDueAt: primary.slaDueAt,
    slaStartedAt: primary.attention.slaStartedAt,
    attentionCreatedAt: primary.attention.createdAt,
    priorityName: primary.attention.priorityName,
    attentionType: primary.attention.attentionType,
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
  attention: {
    select: {
      priorityName: true,
      createdAt: true,
      slaStartedAt: true,
      attentionType: true,
      sellerUserId: true,
      originCompanyId: true,
      serviceCompanyId: true,
      serviceNumber: true,
      originServiceNumber: true,
      adminClient: { select: { id: true, name: true, isSystem: true } },
    },
  },
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

async function attachMissingOrders(cases: CaseRecord[]): Promise<CaseRecord[]> {
  const existing = new Set(cases.map((row) => row.id));
  const diagnosisIds = cases.filter((row) => row.kind === "DIAGNOSTICO").map((row) => row.id);
  if (diagnosisIds.length === 0) return cases;
  const children = await prisma.technicalCase.findMany({
    where: { kind: "OS", spawnedFromId: { in: diagnosisIds }, id: { notIn: [...existing] } },
    include: caseInclude,
  });
  return [...cases, ...(children as CaseRecord[])];
}

async function mapCasesToBandejaRows(companyId: string, cases: CaseRecord[]): Promise<ServicioBandejaRow[]> {
  if (cases.length === 0) return [];

  const casesWithOrders = await attachMissingOrders(cases);
  const casesWithParents = await attachParentDiagnoses(companyId, casesWithOrders);
  const originNumbers = await ensureOriginCompanyServiceNumbers(casesWithParents.map((row) => row.attentionId));
  for (const row of casesWithParents) {
    const n = originNumbers.get(row.attentionId);
    if (n != null) row.attention.originServiceNumber = n;
  }
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
      select: {
        id: true,
        folio: true,
        technicalCaseId: true,
        equipmentId: true,
        status: true,
        quoteType: true,
        discountPct: true,
        updatedAt: true,
        sellerUserId: true,
        lines: { select: { quantity: true, unitPrice: true, authorized: true } },
      },
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
        attentionCases.map((c) => ({ id: c.id, kind: c.kind, spawnedFromId: c.spawnedFromId })),
        primary.equipmentId,
        quotes,
      );
      const sellerName = primary.attention.sellerUserId
        ? sellerMap.get(primary.attention.sellerUserId) ?? null
        : null;
      rows.push(buildServicioRow(attentionId, attentionCases, quote, sellerName, companyId));
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

  await revealAuthorizedIntercompanyOrders();
  await alignIntercompanyWorkshopQuoteClients(companyId);
  const pendingDecisionCaseIds = q
    ? []
    : await technicalCaseIdsPendingSellerDecision(companyId, clientOwnerUserId);

  const activeFilters = [
    technicianId ? technicianActiveCaseWhere(technicianId) : openOperationCaseWhere(),
    hiddenReservedOsStubCaseWhere(),
    ...(clientOwnerUserId ? [clientOwnerScope(clientOwnerUserId)] : []),
    ...(attentionType ? [{ attention: { attentionType } }] : []),
    createdAtRange(options?.desde, options?.hasta),
    ...(q ? [caseSearchWhere(companyId, q)] : []),
  ].filter((part) => Object.keys(part).length > 0);

  const cases = await prisma.technicalCase.findMany({
    where: {
      AND: [
        servicioCompanyScope(companyId, options),
        {
          OR: [
            { AND: activeFilters },
            ...(pendingDecisionCaseIds.length > 0 ? [{ id: { in: pendingDecisionCaseIds } }] : []),
          ],
        },
      ],
    },
    include: caseInclude,
    take: 200,
  });

  let rows = await mapCasesToBandejaRows(companyId, cases as CaseRecord[]);
  const equipmentKind = options?.equipmentKind ?? null;
  if (equipmentKind) {
    rows = rows.filter((row) => row.kind !== "servicio" || row.equipmentKind === equipmentKind);
  }
  return rows.sort((a, b) =>
    compareBySla(
      {
        slaDueAt: a.slaDueAt,
        slaStartedAt: a.slaStartedAt,
        createdAt: a.createdAt,
        express: isReparacionExpressAttentionType(a.attentionType),
      },
      {
        slaDueAt: b.slaDueAt,
        slaStartedAt: b.slaStartedAt,
        createdAt: b.createdAt,
        express: isReparacionExpressAttentionType(b.attentionType),
      },
    ),
  );
}

export async function listHistorialServicios(
  companyId: string,
  query: string,
  options?: ListScope & { status?: string | null },
): Promise<SupervisorServicioRow[]> {
  await revealAuthorizedIntercompanyOrders();
  const tipo = options?.tipo ?? null;
  const attentionType = tipo ? (SERVICIO_TIPO_PARAM[tipo] as AttentionType) : null;
  const q = query.trim();
  const technicianId = options?.assigneeUserId;
  const clientOwnerUserId = options?.clientOwnerUserId;
  await alignIntercompanyWorkshopQuoteClients(companyId);
  const historialStatuses = technicianId ? TECHNICIAN_HISTORIAL_CASE : HISTORIAL_CASE;
  const statusFilter =
    options?.status && options.status !== "todos" && (historialStatuses as readonly string[]).includes(options.status)
      ? options.status
      : null;

  const historialFilters = [
    servicioCompanyScope(companyId, options),
    { status: statusFilter ? statusFilter : { in: [...historialStatuses] } },
    ...(technicianId ? [technicianCaseScope(technicianId)] : []),
    ...(clientOwnerUserId ? [clientOwnerScope(clientOwnerUserId)] : []),
    ...(attentionType ? [{ attention: { attentionType } }] : []),
    updatedAtRange(options?.desde, options?.hasta),
    ...(q ? [caseSearchWhere(companyId, q)] : []),
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
            ...servicioCompanyScope(companyId, options),
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
                    { adminClient: { name: { contains: q } } },
                    { reportedFault: { contains: q } },
                  ],
                }
              : {}),
          },
          include: {
            adminClient: { select: { id: true, name: true, isSystem: true } },
            equipment: { include: { client: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 80,
        });

  let serviceRows = await mapCasesToBandejaRows(companyId, cases as CaseRecord[]);
  const equipmentKind = options?.equipmentKind ?? null;
  if (equipmentKind) {
    serviceRows = serviceRows.filter((row) => row.equipmentKind === equipmentKind);
  }
  const cancelledRows: CancelledServicioBandejaRow[] = cancelledAttentions.map((row) => {
    const shownClient = serviceClientForCompany(companyId, row, row.equipment.client);
    return {
    kind: "cancelado",
    id: row.id,
    equipmentId: row.equipment.id,
    equipmentHref: equipmentDetailHref(row.equipment.kind, row.equipment.id),
    equipmentLabel: formatEquipmentBandejaLabel(row.equipment),
    clientId: shownClient.id,
    clientName: shownClient.name,
    clientIsSystem: shownClient.isSystem,
    closedAt: row.updatedAt,
    createdAt: row.createdAt,
    priorityName: row.priorityName,
    };
  });

  let merged: SupervisorServicioRow[] = [...serviceRows, ...cancelledRows];
  if (equipmentKind) {
    merged = merged.filter((row) => row.kind === "servicio" ? row.equipmentKind === equipmentKind : row.equipmentHref.startsWith(equipmentKind === "MOT" ? "/motores/" : "/equipos/"));
  }
  return merged.sort(
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
