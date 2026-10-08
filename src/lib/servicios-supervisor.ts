import { prisma } from "@/lib/db";
import { compareBySla } from "@/lib/sla";
import { SERVICIO_TIPO_PARAM, type ServicioTipoParam } from "@/lib/servicios-catalog";
import type { AttentionType } from "@/lib/priorities";

export const CLOSED_CASE = ["VALIDADO", "TERMINADA", "SIN_REPARACION"] as const;

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
};

type IngressRow = {
  kind: "ingreso";
  id: string;
  href: string;
  attentionType: AttentionType;
  equipmentFolio: string;
  clientName: string;
  priorityName: string;
  reportedFault: string;
  createdAt: Date;
};

export type SupervisorServicioRow = ActiveCaseRow | IngressRow;

export function servicioRowHighlight(row: SupervisorServicioRow, now = Date.now()) {
  if (row.kind === "ingreso") {
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

export async function listActiveServicios(
  companyId: string,
  query: string,
  options?: { assigneeUserId?: string; tipo?: ServicioTipoParam | null },
): Promise<SupervisorServicioRow[]> {
  const tipo = options?.tipo ?? null;
  const attentionType = tipo ? (SERVICIO_TIPO_PARAM[tipo] as AttentionType) : null;
  const q = query.trim();
  const assigneeOnly = options?.assigneeUserId;

  const cases = await prisma.technicalCase.findMany({
    where: {
      serviceCompanyId: companyId,
      status: { notIn: [...CLOSED_CASE] },
      ...(assigneeOnly ? { assigneeUserId: assigneeOnly } : {}),
      ...(attentionType ? { attention: { attentionType } } : {}),
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

  const caseRows: ActiveCaseRow[] = cases.map((row) => ({
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
  }));

  const sortedCases = caseRows.sort((a, b) =>
    compareBySla(
      { slaDueAt: a.slaDueAt, slaStartedAt: a.slaStartedAt, createdAt: a.createdAt },
      { slaDueAt: b.slaDueAt, slaStartedAt: b.slaStartedAt, createdAt: b.createdAt },
    ),
  );

  return sortedCases;
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
