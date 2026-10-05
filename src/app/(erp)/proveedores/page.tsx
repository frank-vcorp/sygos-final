import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "supplier.operate", session.activeCompanyCode)) redirect("/inicio");
  const { q, estado } = await searchParams;
  const query = (q ?? "").trim();
  const suppliers = await prisma.supplier.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...(estado === "inactivos" ? { active: false } : { active: true }),
      ...(query ? { name: { contains: query } } : {}),
    },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader title="Proveedores" subtitle={session.activeCompanyName ?? ""} action={<Link href="/proveedores/nuevo" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Nuevo proveedor</Link>} />
      <form className="mb-4 flex flex-wrap gap-2" action="/proveedores">
        <input name="q" defaultValue={query} placeholder="Nombre o razón social" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm" />
        <select name="estado" defaultValue={estado ?? "activos"} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <Button type="submit" tone="ghost">Filtrar</Button>
      </form>
      {suppliers.length === 0 ? <Empty title="No hay proveedores" body="Cada empresa mantiene su propio catálogo." /> : (
        <Table>
          <thead><tr><Th>Proveedor</Th><Th>Contacto</Th><Th>Factura</Th></tr></thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <Td><Link className="font-medium text-[var(--accent)]" href={`/proveedores/${supplier.id}`}>{supplier.name}</Link>{supplier.isSystem ? " · intercompañía" : ""}</Td>
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
