import {
  batchLoadBillingDocumentServiceLinks,
  linksForBillingDocument,
  pickBillingDocumentTechnicalCaseId,
} from "@/lib/billing-document-service-links";
import {
  billingListPpdCobranza,
  facturacionListUsesPaymentMethodColumn,
  paymentMethodShortListLabel,
} from "@/lib/billing-list-payment-method";
import { fiscalBadgeInfo } from "@/lib/billing-badges";
import { billingSalesListDetailHref } from "@/lib/billing-sales";
import type { FacturacionListRow } from "@/components/facturacion-documents-list";
import { money } from "@/lib/money";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/roles";
import type { Prisma } from "@prisma/client";

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

const LIST_INCLUDE = {
  client: true,
  quote: { select: { technicalCaseId: true } },
  receivable: {
    select: {
      balance: true,
      applications: {
        where: { confirmedAt: { not: null } },
        select: {
          payment: {
            select: {
              status: true,
              paymentComplement: { select: { fiscalStatus: true } },
            },
          },
        },
      },
    },
  },
  paymentComplementItems: {
    select: {
      complement: { select: { fiscalStatus: true } },
    },
  },
} as const;

type BillingDocumentListRow = Awaited<
  ReturnType<typeof prisma.billingDocument.findMany<{ include: typeof LIST_INCLUDE }>>
>[number];

function mapDocumentToListRow(
  row: BillingDocumentListRow,
  role: Role,
  serviceLinkMap: Awaited<ReturnType<typeof batchLoadBillingDocumentServiceLinks>>,
  showPaymentMethodColumn: boolean,
): FacturacionListRow {
  const serviceLinks = linksForBillingDocument(row, serviceLinkMap);
  const fiscal = fiscalBadgeInfo(row);
  const paymentCode = paymentMethodShortListLabel(row.paymentMethodSnapshot ?? row.client.paymentMethod);
  const ppdCobranza = showPaymentMethodColumn
    ? billingListPpdCobranza({
        documentStatus: row.status,
        kind: row.kind,
        paymentMethodSnapshot: row.paymentMethodSnapshot,
        fiscalStatus: row.fiscalStatus,
        receivableBalance: row.receivable?.balance,
        paymentComplementFiscalStatuses:
          row.paymentComplementItems?.map((item) => item.complement.fiscalStatus) ?? [],
        validatedApplicationComplementStatuses:
          row.receivable?.applications
            .filter((app) => app.payment.status === "VALIDADO")
            .map((app) => app.payment.paymentComplement?.fiscalStatus) ?? [],
        formatBalance: money,
      })
    : null;

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
    detailHref: billingSalesListDetailHref(role, row) ?? `/facturacion/${row.id}`,
    paymentMethodCode: showPaymentMethodColumn ? paymentCode : null,
    ppdCobranza: ppdCobranza ?? undefined,
  };
}

type SessionSlice = {
  role: Role;
  userId: string;
  activeCompanyId: string;
};

export async function loadBillingDocumentListRows(
  session: SessionSlice,
  where: Prisma.BillingDocumentWhereInput,
): Promise<FacturacionListRow[]> {
  const showPaymentMethodColumn = facturacionListUsesPaymentMethodColumn(session.role);
  const rows = await prisma.billingDocument.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...where,
      ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}),
    },
    include: LIST_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const serviceLinkMap = await batchLoadBillingDocumentServiceLinks(
    rows.map((row) => pickBillingDocumentTechnicalCaseId(row)),
    session.activeCompanyId,
  );
  return rows.map((row) => mapDocumentToListRow(row, session.role, serviceLinkMap, showPaymentMethodColumn));
}