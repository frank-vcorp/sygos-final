import { redirect } from "next/navigation";
import { CobranzaVistaFilter } from "@/components/compact-list-filters";
import { CobranzaReceivableList } from "@/components/cobranza-receivable-list";
import { ActiveFilters, Badge, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { coordFilterChips, coordPageSubtitle, coordPageTitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { can } from "@/lib/permissions";
import {
  batchLoadBillingDocumentServiceLinks,
  linksForBillingDocument,
  pickBillingDocumentTechnicalCaseId,
} from "@/lib/billing-document-service-links";
import { requireCompany } from "@/lib/session";

export default async function CobranzaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "receivable.view", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { vista } = await searchParams;
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const own = session.role === "VENTAS" ? { sellerUserId: session.userId } : {};
  const selectedVista = vista === "cxc" || vista === "vencidas" ? vista : "todas";
  const now = new Date();
  const balanceFilter =
    selectedVista === "cxc"
      ? { balance: { gt: 0 } }
      : selectedVista === "vencidas"
        ? { balance: { gt: 0 }, dueAt: { lt: now } }
        : {};
  const rows = await prisma.receivable.findMany({
    where: { companyId: session.activeCompanyId, ...own, ...balanceFilter },
    include: {
      client: true,
      document: { include: { quote: { select: { technicalCaseId: true } } } },
    },
    orderBy: { dueAt: "asc" },
    take: 100,
  });
  const serviceLinkMap = await batchLoadBillingDocumentServiceLinks(
    rows.map((row) => pickBillingDocumentTechnicalCaseId(row.document)),
    session.activeCompanyId,
  );
  const payables = session.activeCompanyCode === "SYSTRON" && (session.role === "ADMINISTRADOR" || session.role === "CEO" || session.role === "COORDINACION_ADMINISTRACION")
    ? await prisma.payable.findMany({ where: { companyId: session.activeCompanyId }, include: { supplier: true, document: true }, orderBy: { dueAt: "asc" } })
    : [];
  const ordered = [...rows].sort((a, b) => {
    const late = (row: typeof a) => row.balance > 0 && row.dueAt.getTime() < Date.now() ? Date.now() - row.dueAt.getTime() : 0;
    return late(b) - late(a);
  });
  const listRows = ordered.map((row) => {
    const serviceLinks = linksForBillingDocument(row.document, serviceLinkMap);
    return {
      id: row.id,
      documentFolio: row.document.folio,
      diagnosisFolio: serviceLinks.diagnosisFolio,
      diagnosisHref: serviceLinks.diagnosisHref,
      osFolio: serviceLinks.osFolio,
      osHref: serviceLinks.osHref,
      clientId: row.client.id,
      clientName: row.client.name,
      clientIsSystem: row.client.isSystem,
      balance: row.balance,
      dueAt: row.dueAt.toISOString(),
      status: row.status,
    };
  });
  const sidebarNav = coordUsesSidebarNav(session.role);
  const vistaTitle =
    selectedVista === "cxc"
      ? "Cuentas por cobrar"
      : selectedVista === "vencidas"
        ? "Cobranza vencida"
        : undefined;
  return (
    <>
      <PageHeader
        title={
          coordPageTitle(
            sidebarNav,
            vistaTitle,
            session.role === "VENTAS" ? "Mi cobranza" : "Cobranza",
          )
        }
        subtitle={coordPageSubtitle(
          sidebarNav,
          session.activeCompanyCode,
          "Saldos de esta empresa. Vencida es saldo después de la fecha.",
          selectedVista === "cxc" ? "Saldos abiertos" : selectedVista === "vencidas" ? "Vencidas" : "Todas las cuentas",
        )}
      />
      {sidebarNav ? null : <CobranzaVistaFilter vista={selectedVista} />}
      <ActiveFilters
        items={coordFilterChips(sidebarNav, [
          ...(selectedVista === "cxc" ? [{ label: "Con saldo", clearHref: "/cobranza" }] : []),
          ...(selectedVista === "vencidas" ? [{ label: "Vencidas", clearHref: "/cobranza" }] : []),
        ])}
      />
      {ordered.length === 0 ? <Empty title="Sin cuentas por cobrar" body="Aparecen cuando Coordinación emite una factura." /> : (
        <CobranzaReceivableList rows={listRows} canEditClient={canEditClient} />
      )}
      {payables.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 font-medium">Cuentas por pagar a Servomotores</h2>
          <Table>
            <thead><tr><Th>Documento</Th><Th>Saldo</Th><Th>Estado</Th><Th>CFDI</Th></tr></thead>
            <tbody>
              {payables.map((row) => {
                const canDownloadCfdi =
                  row.document
                  && (row.document.fiscalStatus === "TIMBRADA" || Boolean(row.document.fiscalExternalId));
                return (
                  <tr key={row.id}>
                    <Td>{row.document?.folio ?? "Compra"}</Td>
                    <Td>{money(row.balance)}</Td>
                    <Td><Badge>{row.status === "SALDADA" ? "Saldada" : row.status === "PARCIAL" ? "Parcial" : "Abierta"}</Badge></Td>
                    <Td>
                      {canDownloadCfdi && row.document ? (
                        <span className="flex flex-wrap gap-2 text-xs">
                          <a href={`/api/billing/documents/${row.document.id}/pdf`} target="_blank" rel="noreferrer" className="font-medium text-[#0a477e] hover:underline">PDF</a>
                          <a href={`/api/billing/documents/${row.document.id}/xml`} className="font-medium text-[#0a477e] hover:underline">XML</a>
                          <a href={`/api/billing/documents/${row.document.id}/zip`} className="font-medium text-[#0a477e] hover:underline">ZIP</a>
                        </span>
                      ) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      ) : null}
    </>
  );
}
