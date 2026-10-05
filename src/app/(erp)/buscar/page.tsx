import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function BuscarPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "search.global")) redirect("/inicio");
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  if (query.length < 2) {
    return (
      <>
        <PageHeader title="Búsqueda" subtitle={`Solo dentro de ${session.activeCompanyName}.`} />
        <Empty title="Escribe al menos 2 caracteres" body="Busca clientes, prospectos y proveedores de la empresa activa." />
      </>
    );
  }
  const contains = { contains: query };
  const [clients, prospects, suppliers] = await Promise.all([
    prisma.client.findMany({ where: { companyId: session.activeCompanyId, name: contains }, take: 20 }),
    prisma.prospect.findMany({ where: { companyId: session.activeCompanyId, name: contains }, take: 20 }),
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, isSystem: false, name: contains }, take: 20 }),
  ]);
  const rows = [
    ...clients.map((row) => ({ href: `/clientes/${row.id}`, kind: "Cliente", label: row.name })),
    ...prospects.map((row) => ({ href: `/prospectos/${row.id}`, kind: "Prospecto", label: row.name })),
    ...suppliers.map((row) => ({ href: `/proveedores/${row.id}`, kind: "Proveedor", label: row.name })),
  ];
  return (
    <>
      <PageHeader title={`Resultados para “${query}”`} subtitle={session.activeCompanyName ?? ""} />
      {rows.length === 0 ? (
        <Empty title="Sin coincidencias" body="No hay registros con ese texto en la empresa activa." />
      ) : (
        <ul className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-white">
          {rows.map((row) => (
            <li key={row.href}>
              <Link href={row.href} className="flex items-center justify-between px-4 py-3 hover:bg-[#f7f8f9]">
                <span className="font-medium">{row.label}</span>
                <span className="text-xs text-[var(--muted)]">{row.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
