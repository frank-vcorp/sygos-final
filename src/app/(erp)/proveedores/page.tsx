import { redirect } from "next/navigation";
import { ActionLink, ActiveFilters, Button, controlClass, Empty, FilterBar, PageHeader, RecordLink, Table, Td, Th } from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
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
      <PageHeader title="Proveedores" subtitle={session.activeCompanyName ?? ""} action={<ActionLink href="/proveedores/nuevo">Nuevo proveedor</ActionLink>} />
      <FilterBar action="/proveedores">
        <input name="q" defaultValue={query} placeholder="Nombre o razón social" className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} />
        <select name="estado" defaultValue={estadoFilter} className={`${controlClass} sm:w-auto`}>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(estadoFilter === "inactivos" ? [{ label: "Inactivos", clearHref: listHref("/proveedores", { q: query || undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: listHref("/proveedores", { estado: estadoFilter === "inactivos" ? "inactivos" : undefined }) }] : []),
        ]}
      />
      {suppliers.length === 0 ? <Empty title="No hay proveedores" body="Cada empresa mantiene su propio catálogo." /> : (
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
      )}
    </>
  );
}
