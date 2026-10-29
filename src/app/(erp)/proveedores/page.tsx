import { redirect } from "next/navigation";
import { SupplierCreateModal } from "./supplier-create-modal";
import { ProveedoresListFilter } from "@/components/compact-list-filters";
import { ActiveFilters, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { coordPageSubtitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "supplier.operate", session.activeCompanyCode)) redirect("/inicio");
  const { q, estado } = await searchParams;
  const query = (q ?? "").trim();
  const estadoFilter = estado === "inactivos" ? "inactivos" : "activos";
  const suppliers = await prisma.supplier.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...(estadoFilter === "inactivos" ? { active: false } : { active: true }),
      ...(query ? { name: { contains: query } } : {}),
    },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        title="Proveedores"
        subtitle={coordPageSubtitle(
          coordUsesSidebarNav(session.role),
          session.activeCompanyCode,
          session.activeCompanyName ?? "Catálogo de proveedores",
          "Catálogo por empresa",
        )}
        action={<SupplierCreateModal />}
      />
      <ProveedoresListFilter q={query} estado={estadoFilter} />
      <ActiveFilters
        items={[
          ...(estadoFilter === "inactivos" ? [{ label: "Inactivos", clearHref: listHref("/proveedores", { q: query || undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: listHref("/proveedores", { estado: estadoFilter === "inactivos" ? "inactivos" : undefined }) }] : []),
        ]}
      />
      {suppliers.length === 0 ? <Empty title="No hay proveedores" body="Cada empresa mantiene su propio catálogo." /> : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Proveedor</Th><Th>Contacto</Th><Th>Factura</Th></tr></thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <Td><RecordLink href={`/proveedores/${supplier.id}`}>{supplier.name}</RecordLink>{supplier.isSystem ? " · intercompañía" : ""}</Td>
                    <Td>{supplier.contactName ?? "—"}</Td>
                    <Td>{supplier.issuesInvoice == null ? "Sin definir" : supplier.issuesInvoice ? "Sí" : "No"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={suppliers.map((supplier) => (
            <MobileCard
              key={supplier.id}
              href={`/proveedores/${supplier.id}`}
              title={supplier.name}
              meta={supplier.isSystem ? "Intercompañía" : undefined}
            >
              <p>Contacto: {supplier.contactName ?? "—"}</p>
              <p className="mt-1">Factura: {supplier.issuesInvoice == null ? "Sin definir" : supplier.issuesInvoice ? "Sí" : "No"}</p>
            </MobileCard>
          ))}
        />
      )}
    </>
  );
}
