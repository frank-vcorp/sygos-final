import { redirect } from "next/navigation";
import { FacturacionDocumentsList } from "@/components/facturacion-documents-list";
import { Empty, PageHeader } from "@/components/ui";
import { loadBillingDocumentListRows } from "@/lib/billing-documents-list-data";
import { billingUsesSplitRemisionesNav } from "@/lib/billing-nav-split";
import { coordPageSubtitle, coordPageTitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { can } from "@/lib/permissions";
import { homePath } from "@/lib/home";
import { requireCompany } from "@/lib/session";

export default async function RemisionesPage() {
  const session = await requireCompany();
  if (!can(session.role, "invoice.request", session.activeCompanyCode) && !can(session.role, "invoice.issue", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  if (!billingUsesSplitRemisionesNav(session.role)) redirect("/facturacion?vista=remisiones");
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const documentListRows = await loadBillingDocumentListRows(session, { kind: "REMISION" });
  const sidebarNav = coordUsesSidebarNav(session.role);
  return (
    <>
      <PageHeader
        title={coordPageTitle(sidebarNav, "Remisiones", "Remisiones")}
        subtitle={coordPageSubtitle(
          sidebarNav,
          session.activeCompanyCode,
          "Remisiones emitidas y en solicitud de esta empresa.",
          "Consulta y emisión",
        )}
      />
      {documentListRows.length === 0 ? (
        <Empty title="Sin remisiones" body="Las remisiones surgen de operaciones autorizadas o de clientes que no requieren factura." />
      ) : (
        <FacturacionDocumentsList rows={documentListRows} canEditClient={canEditClient} />
      )}
    </>
  );
}