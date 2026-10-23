import { prisma } from "@/lib/db";
import type { ServicioBandejaRow } from "@/lib/servicios-supervisor";

const CLOSED = ["VALIDADO", "TERMINADA", "SIN_REPARACION"] as const;

export const GERENTE_SERVICIO_PANEL_FILTROS = {
  validacion: "Pendientes de validación",
  vencidos: "Vencidos (SLA)",
  refacciones: "Refacciones solicitadas",
  compras: "Compras solicitadas",
  asignacion: "Pendientes de asignación",
} as const;

export type GerenteServicioPanelFiltro = keyof typeof GERENTE_SERVICIO_PANEL_FILTROS;

export function parseGerenteServicioPanelFiltro(value: string | undefined): GerenteServicioPanelFiltro | null {
  if (!value) return null;
  return value in GERENTE_SERVICIO_PANEL_FILTROS ? (value as GerenteServicioPanelFiltro) : null;
}

export type GerenteServicioPanelContext = {
  now: number;
  refaccionAttentionIds: Set<string>;
  purchaseRefs: Set<string>;
};

export async function loadGerenteServicioPanelContext(companyId: string): Promise<GerenteServicioPanelContext> {
  const [partRequests, pendingPurchases] = await Promise.all([
    prisma.partRequest.findMany({
      where: { companyId, case: { status: { notIn: [...CLOSED] } } },
      include: { case: { select: { attentionId: true } } },
    }),
    prisma.purchase.findMany({
      where: {
        companyId,
        status: { in: ["PENDIENTE_VALIDAR", "PENDIENTE_AUTORIZACION"] },
      },
      select: { destinationRef: true },
    }),
  ]);
  return {
    now: Date.now(),
    refaccionAttentionIds: new Set(
      partRequests.filter((row) => row.qtyIssued < row.qtyRequested).map((row) => row.case.attentionId),
    ),
    purchaseRefs: new Set(
      pendingPurchases
        .map((row) => row.destinationRef?.trim())
        .filter((ref): ref is string => Boolean(ref)),
    ),
  };
}

function servicioMatchesPendingPurchase(row: ServicioBandejaRow, purchaseRefs: ReadonlySet<string>): boolean {
  if (purchaseRefs.size === 0) return false;
  if (row.osFolio && purchaseRefs.has(row.osFolio)) return true;
  if (row.diagnosisFolio && purchaseRefs.has(row.diagnosisFolio)) return true;
  for (const ref of purchaseRefs) {
    if (row.equipmentLabel.includes(ref)) return true;
  }
  return false;
}

export function filterServicioBandejaForGerentePanel(
  rows: ServicioBandejaRow[],
  filtro: GerenteServicioPanelFiltro,
  ctx: GerenteServicioPanelContext,
): ServicioBandejaRow[] {
  switch (filtro) {
    case "validacion":
      return rows.filter((row) => row.primaryStatus === "PENDIENTE_VALIDACION");
    case "vencidos":
      return rows.filter((row) => row.slaDueAt != null && row.slaDueAt.getTime() < ctx.now);
    case "refacciones":
      return rows.filter((row) => ctx.refaccionAttentionIds.has(row.id));
    case "compras":
      return rows.filter((row) => servicioMatchesPendingPurchase(row, ctx.purchaseRefs));
    case "asignacion":
      return rows.filter((row) => row.technicianName === null);
    default:
      return rows;
  }
}

export function gerentePanelSections(
  servicioRows: ServicioBandejaRow[],
  ctx: GerenteServicioPanelContext,
): Array<{ filtro: GerenteServicioPanelFiltro; rows: ServicioBandejaRow[] }> {
  return (Object.keys(GERENTE_SERVICIO_PANEL_FILTROS) as GerenteServicioPanelFiltro[]).map((filtro) => ({
    filtro,
    rows: filterServicioBandejaForGerentePanel(servicioRows, filtro, ctx),
  }));
}
