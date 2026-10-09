import { prisma } from "@/lib/db";
import { compareBySla } from "@/lib/sla";
import { parseServiciosDateBoundary, SERVICIO_TIPO_PARAM, type ServicioTipoParam } from "@/lib/servicios-catalog";
import type { AttentionType } from "@/lib/priorities";

export const CLOSED_CASE = ["VALIDADO", "TERMINADA", "SIN_REPARACION"] as const;
export const HISTORIAL_CASE = [...CLOSED_CASE, "CANCELADA"] as const;

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

type ActiveCaseRow = {
  kind: "operacion";
  id: string;
  href: string;
  folio: string;
  attentionType: AttentionType;
  equipmentFolio: string;
  equipmentModel: string;
  clientName: string;
  priorityName: string;
  status: string;
  assigneeName: string | null;
  externalSupplier: boolean;
  slaDueAt: Date | null;
  slaStartedAt: Date | null;
  createdAt: Date;
  closedAt?: Date | null;
};

type CancelledAttentionRow = {
  kind: "atencion_cancelada";
  id: string;
  href: string;
  attentionType: AttentionType;
  equipmentFolio: string;
  clientName: string;
  priorityName: string;
  reportedFault: string;
  status: string;
  createdAt: Date;
  closedAt: Date;
};

type EsperaIngresoAttentionRow = {
  kind: "espera_ingreso";
  id: string;
  href: string;
  attentionType: AttentionType;
  equipmentFolio: string;
  clientName: string;
  priorityName: string;
  reportedFault: string;
  status: string;
  createdAt: Date;
};

export type SupervisorServicioRow = ActiveCaseRow | CancelledAttentionRow | EsperaIngresoAttentionRow;

export function servicioRowHighlight(row: SupervisorServicioRow, now = Date.now()) {
  if (row.kind === "atencion_cancelada" || row.kind === "espera_ingreso") {
    return { wrapClass: "", statusTone: "neutral" as const, markers: [] as string[] };
  }
  const overdue = row.slaDueAt != null && row.slaDueAt.getTime() < now;
  const refacciones = row.status === "EN_ESPERA_REFACCIONES";
  const markers: string[] = [];
  if (overdue) markers.push("Vencido");
  if (refacciones) markers.push("Refacciones");
  let wrapClass = "";
  if (overdue) wrapClass = "bg-[#fff7ed] ring-1 ring-inset ring-[#fdba74]";
  else if (refacciones) wrapClass = "bg-[#eff6ff] ring-1 ring-inset ring-[#93c5fd]";
  const statusTone = overdue ? ("warn" as const) : refacciones ? ("ok" as const) : ("neutral" as const);
  return { wrapClass, statusTone, markers };
}

function mapCaseRow(row: {
  id: string;
  folio: string;
  status: string;
  slaDueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  validatedAt: Date | null;
  externalSupplierId: string | null;
  equipment: { folio: string; model: string; kind: string; client: { name: string } };
  attention: { priorityName: string; slaStartedAt: Date | null; attentionType: string };
  assignee: { name: string } | null;
}): ActiveCaseRow {
  return {
    kind: "operacion",
    id: row.id,
    href: `/operacion/${row.id}`,
    folio: row.folio,
    attentionType: row.attention.attentionType as AttentionType,
    equipmentFolio: row.equipment.folio,
    equipmentModel: row.equipment.model,
    clientName: row.equipment.client.name,
    priorityName: row.attention.priorityName,
    status: row.status,
    assigneeName: row.assignee?.name ?? null,
    externalSupplier: Boolean(row.externalSupplierId),
    slaDueAt: row.slaDueAt,
    slaStartedAt: row.attention.slaStartedAt,
    createdAt: row.createdAt,
    closedAt: row.validatedAt ?? row.updatedAt,
  };
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

  const cases = await prisma.technicalCase.findMany({
    where: {
      serviceCompanyId: companyId,
      ...openOperationCaseWhere(),
      ...(technicianId ? technicianCaseScope(technicianId) : {}),
      ...(clientOwnerUserId ? clientOwnerScope(clientOwnerUserId) : {}),
      ...(attentionType ? { attention: { attentionType } } : {}),
      ...createdAtRange(options?.desde, options?.hasta),
      ...(q
        ? {
            OR: [
              { folio: { contains: q } },
              { equipment: { folio: { contains: q } } },
              { equipment: { client: { name: { contains: q } } } },
              { attention: { reportedFault: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      equipment: { include: { client: true } },
      attention: { select: { priorityName: true, slaStartedAt: true, attentionType: true } },
      assignee: { select: { name: true } },
    },
    take: 200,
  });

  const caseRows = cases.map((row) => mapCaseRow(row));

  const waitingAttentions =
    clientOwnerUserId && !technicianId
      ? await prisma.attention.findMany({
          where: {
            serviceCompanyId: companyId,
            status: "ABIERTA",
            equipment: { client: { ownerUserId: clientOwnerUserId, isSystem: false } },
            technicalCases: { none: {} },
            ...(attentionType ? { attentionType } : {}),
            ...createdAtRange(options?.desde, options?.hasta),
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
          orderBy: { createdAt: "desc" },
          take: 80,
        })
      : [];

  const waitingRows: EsperaIngresoAttentionRow[] = waitingAttentions.map((row) => ({
    kind: "espera_ingreso",
    id: row.id,
    href: row.equipment.kind === "MOT" ? `/motores/${row.equipmentId}` : `/equipos/${row.equipmentId}`,
    attentionType: row.attentionType as AttentionType,
    equipmentFolio: row.equipment.folio,
    clientName: row.equipment.client.name,
    priorityName: row.priorityName,
    reportedFault: row.reportedFault,
    status: "ABIERTA",
    createdAt: row.createdAt,
  }));

  return [...caseRows, ...waitingRows].sort((a, b) =>
    compareBySla(
      {
        slaDueAt: a.kind === "operacion" ? a.slaDueAt : null,
        slaStartedAt: a.kind === "operacion" ? a.slaStartedAt : null,
        createdAt: a.createdAt,
      },
      {
        slaDueAt: b.kind === "operacion" ? b.slaDueAt : null,
        slaStartedAt: b.kind === "operacion" ? b.slaStartedAt : null,
        createdAt: b.createdAt,
      },
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
  const statusFilter =
    options?.status && options.status !== "todos" && (HISTORIAL_CASE as readonly string[]).includes(options.status)
      ? options.status
      : null;

  const cases = await prisma.technicalCase.findMany({
    where: {
      serviceCompanyId: companyId,
      status: statusFilter ? statusFilter : { in: [...HISTORIAL_CASE] },
      ...(technicianId ? technicianCaseScope(technicianId) : {}),
      ...(clientOwnerUserId ? clientOwnerScope(clientOwnerUserId) : {}),
      ...(attentionType ? { attention: { attentionType } } : {}),
      ...updatedAtRange(options?.desde, options?.hasta),
      ...(q
        ? {
            OR: [
              { folio: { contains: q } },
              { equipment: { folio: { contains: q } } },
              { equipment: { client: { name: { contains: q } } } },
              { attention: { reportedFault: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      equipment: { include: { client: true } },
      attention: { select: { priorityName: true, slaStartedAt: true, attentionType: true, status: true } },
      assignee: { select: { name: true } },
    },
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

  const caseRows = cases.map((row) => mapCaseRow(row));
  const cancelledRows: CancelledAttentionRow[] = cancelledAttentions.map((row) => ({
    kind: "atencion_cancelada",
    id: row.id,
    href: row.equipment.kind === "MOT" ? `/motores/${row.equipmentId}` : `/equipos/${row.equipmentId}`,
    attentionType: row.attentionType as AttentionType,
    equipmentFolio: row.equipment.folio,
    clientName: row.equipment.client.name,
    priorityName: row.priorityName,
    reportedFault: row.reportedFault,
    status: "CANCELADA",
    createdAt: row.createdAt,
    closedAt: row.updatedAt,
  }));

  return [...caseRows, ...cancelledRows].sort(
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
