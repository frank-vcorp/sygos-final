import type { Prisma } from "@prisma/client";
import {
  batchLoadBillingDocumentServiceLinks,
  linksForBillingDocument,
  pickBillingDocumentTechnicalCaseId,
} from "@/lib/billing-document-service-links";
import { fiscalBadgeInfo } from "@/lib/billing-badges";
import { billingSalesListDetailHref } from "@/lib/billing-sales";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/roles";

export type FacturacionVista = "solicitudes" | "facturas" | "canceladas" | "remisiones" | "todas";

export function parseFacturacionVista(raw: string | undefined, invoicesOnlyNav: boolean): FacturacionVista {
  if (raw === "solicitudes" || raw === "facturas" || raw === "canceladas" || raw === "remisiones") return raw;
  return invoicesOnlyNav ? "facturas" : "todas";
}

export function whereForFacturacionVista(vista: FacturacionVista, invoicesOnlyNav: boolean): Prisma.BillingDocumentWhereInput {
  if (vista === "solicitudes") return { status: "SOLICITADA", ...(invoicesOnlyNav ? { kind: { not: "REMISION" } } : {}) };
  if (vista === "remisiones") return { kind: "REMISION" };
  if (vista === "canceladas") return { status: "CANCELADA", ...(invoicesOnlyNav ? { kind: { not: "REMISION" } } : {}) };
  if (vista === "facturas") return { kind: { not: "REMISION" }, status: { not: "CANCELADA" } };
  if (invoicesOnlyNav) return { kind: { not: "REMISION" } };
  return {};
}

export type BillingDocumentListRow = {
  id: string;
  folio: string;
  diagnosisFolio: string | null;
  diagnosisHref: string | null;
  osFolio: string | null;
  osHref: string | null;
  kind: string;
  clientId: string;
  clientName: string;
  clientIsSystem: boolean;
  status: string;
  total: number;
  createdAt: string;
  fiscalTone: "ok" | "warn" | "neutral" | "danger" | null;
  fiscalLabel: string | null;
  detailHref: string;
};

type SessionSlice = {
  role: Role;
  userId: string;
  activeCompanyId: string;
};

export async function loadBillingDocumentListRows(
  session: SessionSlice,
  where: Prisma.BillingDocumentWhereInput,
): Promise<BillingDocumentListRow[]> {
  const rows = await prisma.billingDocument.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...where,
      ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}),
    },
    include: { client: true, quote: { select: { technicalCaseId: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const serviceLinkMap = await batchLoadBillingDocumentServiceLinks(
    rows.map((row) => pickBillingDocumentTechnicalCaseId(row)),
    session.activeCompanyId,
  );
  return rows.map((row) => {
    const serviceLinks = linksForBillingDocument(row, serviceLinkMap);
    const fiscal = fiscalBadgeInfo(row);
    return {
      id: row.id,
      folio: row.folio,
      diagnosisFolio: serviceLinks.diagnosisFolio,
      diagnosisHref: serviceLinks.diagnosisHref,
      osFolio: serviceLinks.osFolio,
      osHref: serviceLinks.osHref,
      kind: row.kind,
      clientId: row.client.id,
      clientName: row.client.name,
      clientIsSystem: row.client.isSystem,
      status: row.status,
      total: row.total,
      createdAt: row.createdAt.toISOString(),
      fiscalTone: fiscal?.tone ?? null,
      fiscalLabel: fiscal?.label ?? null,
      detailHref: billingSalesListDetailHref(session.role, row) ?? `/facturacion/${row.id}`,
    };
  });
}