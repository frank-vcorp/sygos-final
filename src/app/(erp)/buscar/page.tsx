import { redirect } from "next/navigation";
import { ActiveFilters, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, TextLink, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { partInventorySearchWhere } from "@/lib/inventory-search";
import { listHref } from "@/lib/list-url";
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
  const partWhere = partInventorySearchWhere(session.activeCompanyId, query);
  const systron = session.activeCompanyCode === "SERVOMOTORES"
    ? await prisma.company.findUnique({ where: { code: "SYSTRON" } })
    : null;
  const [clients, prospects, suppliers, equipment, parts, operations] = await Promise.all([
    prisma.client.findMany({ where: { companyId: session.activeCompanyId, name: { contains: query } }, take: 20 }),
    prisma.prospect.findMany({ where: { companyId: session.activeCompanyId, name: { contains: query } }, take: 20 }),
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, isSystem: false, name: { contains: query } }, take: 20 }),
    prisma.equipment.findMany({
      where: {
        AND: [
          session.activeCompanyCode === "SYSTRON"
            ? { originCompanyId: session.activeCompanyId }
            : { kind: "MOT", OR: [{ originCompanyId: session.activeCompanyId }, ...(systron ? [{ originCompanyId: systron.id }] : [])] },
          { OR: [{ folio: { contains: query } }, { model: { contains: query } }, { serial: { contains: query } }] },
        ],
      },
      take: 20,
    }),
    partWhere
      ? prisma.part.findMany({
          where: partWhere,
          take: 20,
        })
      : Promise.resolve([]),
    prisma.technicalCase.findMany({
      where: {
        folio: { contains: query },
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
    ...parts.map((row) => ({
      href: listHref("/inventario", { q: row.partNumber || row.description || query }),
      kind: "Refacción",
      label: `${row.partNumber} · ${row.description}`,
    })),
    ...operations.map((row) => ({ href: `/operacion/${row.id}`, kind: row.kind === "OS" ? "Orden de servicio" : "Diagnóstico", label: row.folio })),
  ];
  return (
    <>
      <PageHeader title="Búsqueda global" subtitle={session.activeCompanyName ?? ""} />
      <ActiveFilters items={[{ label: `“${query}”`, clearHref: "/buscar" }]} />
      {rows.length === 0 ? (
        <Empty title="Sin coincidencias" body="No hay registros con ese texto en la empresa activa." action={<TextLink href="/buscar">Nueva búsqueda</TextLink>} />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Registro</Th>
                  <Th>Tipo</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.kind}-${row.href}-${row.label}`}>
                    <Td>
                      <RecordLink href={row.href}>{row.label}</RecordLink>
                    </Td>
                    <Td className="text-[var(--muted)]">{row.kind}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => (
            <MobileCard key={`${row.kind}-${row.href}-${row.label}`} href={row.href} title={row.label} meta={row.kind} />
          ))}
        />
      )}
    </>
  );
}
