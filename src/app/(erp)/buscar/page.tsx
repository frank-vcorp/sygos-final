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
        <Empty title="Escribe al menos 2 caracteres" body="Busca clientes, prospectos, proveedores, equipos y refacciones de la empresa activa." />
      </>
    );
  }
  const contains = { contains: query };
  const systron = session.activeCompanyCode === "SERVOMOTORES"
    ? await prisma.company.findUnique({ where: { code: "SYSTRON" } })
    : null;
  const [clients, prospects, suppliers, equipment, parts, operations] = await Promise.all([
    prisma.client.findMany({ where: { companyId: session.activeCompanyId, name: contains }, take: 20 }),
    prisma.prospect.findMany({ where: { companyId: session.activeCompanyId, name: contains }, take: 20 }),
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, isSystem: false, name: contains }, take: 20 }),
    prisma.equipment.findMany({
      where: {
        AND: [
          session.activeCompanyCode === "SYSTRON"
            ? { originCompanyId: session.activeCompanyId }
            : { kind: "MOT", OR: [{ originCompanyId: session.activeCompanyId }, ...(systron ? [{ originCompanyId: systron.id }] : [])] },
          { OR: [{ folio: contains }, { model: contains }, { serial: contains }] },
        ],
      },
      take: 20,
    }),
    prisma.part.findMany({
      where: { companyId: session.activeCompanyId, OR: [{ partNumber: contains }, { description: contains }] },
      take: 20,
    }),
    prisma.technicalCase.findMany({
      where: {
        folio: contains,
        OR: [{ serviceCompanyId: session.activeCompanyId }, { equipment: { originCompanyId: session.activeCompanyId } }],
      },
      take: 20,
    }),
  ]);
  const rows = [
    ...clients.map((row) => ({ href: `/clientes/${row.id}`, kind: "Cliente", label: row.name })),
    ...prospects.map((row) => ({ href: `/prospectos/${row.id}`, kind: "Prospecto", label: row.name })),
    ...suppliers.map((row) => ({ href: `/proveedores/${row.id}`, kind: "Proveedor", label: row.name })),
    ...equipment.map((row) => ({ href: row.kind === "MOT" ? `/motores/${row.id}` : `/equipos/${row.id}`, kind: row.kind, label: `${row.folio} · ${row.model}` })),
    ...parts.map((row) => ({ href: "/inventario", kind: "Refacción", label: `${row.partNumber} · ${row.description}` })),
    ...operations.map((row) => ({ href: `/operacion/${row.id}`, kind: row.kind === "OS" ? "Orden de servicio" : "Diagnóstico", label: row.folio })),
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
