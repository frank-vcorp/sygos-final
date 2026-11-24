import { redirect } from "next/navigation";
import { BillingVistaFilter } from "@/components/compact-list-filters";
import { FacturacionDocumentsList } from "@/components/facturacion-documents-list";
import { ActionLink, ActiveFilters, Empty, PageHeader } from "@/components/ui";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { coordFilterChips, coordPageSubtitle, coordPageTitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { can } from "@/lib/permissions";
import {
  batchLoadBillingDocumentServiceLinks,
  linksForBillingDocument,
  pickBillingDocumentTechnicalCaseId,
} from "@/lib/billing-document-service-links";
import { fiscalBadgeInfo } from "@/lib/billing-badges";
import { billingSalesListDetailHref } from "@/lib/billing-sales";
import { requireCompany } from "@/lib/session";

type Vista = "solicitudes" | "facturas" | "canceladas" | "remisiones" | "todas";

function parseVista(raw: string | undefined): Vista {
  if (raw === "solicitudes" || raw === "facturas" || raw === "canceladas" || raw === "remisiones") return raw;
  return "todas";
}

export default async function FacturacionPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "invoice.request", session.activeCompanyCode) && !can(session.role, "invoice.issue", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { vista: vistaRaw } = await searchParams;
  const vista = parseVista(vistaRaw);
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const where =
    vista === "solicitudes"
      ? { status: "SOLICITADA" }
      : vista === "remisiones"
        ? { kind: "REMISION" }
        : vista === "canceladas"
          ? { status: "CANCELADA" }
          : vista === "facturas"
            ? { kind: { not: "REMISION" }, status: { not: "CANCELADA" } }
            : {};
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
  const documentListRows = rows.map((row) => {
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
      detailHref: billingSalesListDetailHref(session.role, row),
    };
  });
  const tabs: Array<{ href: string; label: string; active: boolean; key: Vista }> = [
    { href: "/facturacion", label: "Todas", active: vista === "todas", key: "todas" },
    { href: "/facturacion?vista=solicitudes", label: "Solicitudes", active: vista === "solicitudes", key: "solicitudes" },
    { href: "/facturacion?vista=facturas", label: "Facturas", active: vista === "facturas", key: "facturas" },
    { href: "/facturacion?vista=remisiones", label: "Remisiones", active: vista === "remisiones", key: "remisiones" },
    { href: "/facturacion?vista=canceladas", label: "Canceladas", active: vista === "canceladas", key: "canceladas" },
  ];
  const vistaLabel = tabs.find((tab) => tab.key === vista)?.label;
  const sidebarNav = coordUsesSidebarNav(session.role);
  return (
    <>
      <PageHeader
        title={coordPageTitle(sidebarNav, vista !== "todas" ? vistaLabel : undefined, "Facturación")}
        subtitle={coordPageSubtitle(
          sidebarNav,
          session.activeCompanyCode,
          "Solicitud, emisión y remisión de esta empresa. El timbrado no se duplica.",
          vista === "solicitudes" ? "Pendientes de emitir" : vista === "facturas" ? "Emitidas" : "Solicitudes y emisión",
        )}
        action={can(session.role, "invoice.issue", session.activeCompanyCode) ? <ActionLink href="/facturacion/nuevo">Factura libre</ActionLink> : null}
      />
      {sidebarNav ? null : <BillingVistaFilter vista={vista} options={tabs.map((tab) => ({ value: tab.key, label: tab.label }))} />}
      <ActiveFilters
        items={coordFilterChips(sidebarNav, vista !== "todas" && vistaLabel ? [{ label: vistaLabel, clearHref: "/facturacion" }] : [])}
      />
      {rows.length === 0 ? <Empty title="Sin documentos" body="Una factura nace de una operación autorizada o de una factura libre." /> : (
        <FacturacionDocumentsList rows={documentListRows} canEditClient={canEditClient} />
      )}
    </>
  );
}
