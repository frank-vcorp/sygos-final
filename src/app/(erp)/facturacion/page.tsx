import { redirect } from "next/navigation";
import { BillingVistaFilter } from "@/components/compact-list-filters";
import { FacturacionDocumentsList } from "@/components/facturacion-documents-list";
import { ActionLink, ActiveFilters, Empty, PageHeader } from "@/components/ui";
import { homePath } from "@/lib/home";
import {
  loadBillingDocumentListRows,
  parseFacturacionVista,
  whereForFacturacionVista,
} from "@/lib/billing-documents-list-data";
import { billingUsesSplitRemisionesNav } from "@/lib/billing-nav-split";
import { facturacionListUsesPaymentMethodColumn } from "@/lib/billing-list-payment-method";
import { coordFilterChips, coordPageSubtitle, coordPageTitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function FacturacionPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "invoice.request", session.activeCompanyCode) && !can(session.role, "invoice.issue", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { vista: vistaRaw } = await searchParams;
  const invoicesOnlyNav = billingUsesSplitRemisionesNav(session.role);
  if (invoicesOnlyNav && vistaRaw === "remisiones") redirect("/remisiones");
  const vista = parseFacturacionVista(vistaRaw, invoicesOnlyNav);
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const where = whereForFacturacionVista(vista, invoicesOnlyNav);
  const documentListRows = await loadBillingDocumentListRows(session, where);
  const showPaymentMethodColumn = facturacionListUsesPaymentMethodColumn(session.role);
  const allTabs = [
    { href: "/facturacion", label: "Todas", active: vista === "todas", key: "todas" as const },
    { href: "/facturacion?vista=solicitudes", label: "Solicitudes", active: vista === "solicitudes", key: "solicitudes" as const },
    { href: "/facturacion?vista=facturas", label: "Facturas", active: vista === "facturas", key: "facturas" as const },
    { href: "/facturacion?vista=remisiones", label: "Remisiones", active: vista === "remisiones", key: "remisiones" as const },
    { href: "/facturacion?vista=canceladas", label: "Canceladas", active: vista === "canceladas", key: "canceladas" as const },
  ];
  const tabs = invoicesOnlyNav
    ? allTabs.filter((tab) => tab.key !== "remisiones" && tab.key !== "todas")
    : allTabs;
  const vistaLabel = tabs.find((tab) => tab.key === vista)?.label ?? allTabs.find((tab) => tab.key === vista)?.label;
  const sidebarNav = coordUsesSidebarNav(session.role);
  const invoiceOnlySubtitle = "Solicitud y emisión de facturas de esta empresa. El timbrado no se duplica.";
  return (
    <>
      <PageHeader
        title={coordPageTitle(sidebarNav, vista !== "todas" && vista !== "facturas" ? vistaLabel : undefined, "Facturación")}
        subtitle={coordPageSubtitle(
          sidebarNav,
          session.activeCompanyCode,
          invoicesOnlyNav ? invoiceOnlySubtitle : "Solicitud, emisión y remisión de esta empresa. El timbrado no se duplica.",
          vista === "solicitudes" ? "Pendientes de emitir" : vista === "facturas" ? "Emitidas" : vista === "canceladas" ? "Canceladas" : "Solicitudes y emisión",
        )}
        action={can(session.role, "invoice.issue", session.activeCompanyCode) ? <ActionLink href="/facturacion/nuevo">Factura libre</ActionLink> : null}
      />
      {sidebarNav ? null : <BillingVistaFilter vista={vista} options={tabs.map((tab) => ({ value: tab.key, label: tab.label }))} />}
      <ActiveFilters
        items={coordFilterChips(
          sidebarNav,
          vista !== "todas" && vista !== "facturas" && vistaLabel ? [{ label: vistaLabel, clearHref: invoicesOnlyNav ? "/facturacion?vista=facturas" : "/facturacion" }] : [],
        )}
      />
      {documentListRows.length === 0 ? <Empty title="Sin documentos" body="Una factura nace de una operación autorizada o de una factura libre." /> : (
        <FacturacionDocumentsList
          rows={documentListRows}
          canEditClient={canEditClient}
          showPaymentMethodColumn={showPaymentMethodColumn}
        />
      )}
    </>
  );
}