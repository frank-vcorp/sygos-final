import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Button, Empty, ListCap, PageHeader, Table, Td, Th, TextLink } from "@/components/ui";
import { CUSTODY_LABEL, type Custody } from "@/lib/custody";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function EquiposPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "equi.view", session.activeCompanyCode)) redirect("/inicio");
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const rows = await prisma.equipment.findMany({
    where: {
      kind: "EQUI",
      originCompanyId: session.activeCompanyId,
      ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}),
      ...(query
        ? { OR: [{ folio: { contains: query } }, { model: { contains: query } }, { serial: { contains: query } }, { client: { name: { contains: query } } }] }
        : {}),
    },
    include: { client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        title="Equipos"
        subtitle="Identidad EQUI de SYSTRON. El folio no se reutiliza."
        action={can(session.role, "equi.create", session.activeCompanyCode) ? <Link href="/equipos/nuevo" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Nuevo EQUI</Link> : null}
      />
      <form className="mb-4 flex gap-2" action="/equipos">
        <input name="q" defaultValue={query} placeholder="Folio, modelo, serie o cliente" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm" />
        <Button type="submit" tone="ghost">Buscar</Button>
      </form>
      {rows.length === 0 ? (
        <Empty
          title={query ? "Sin coincidencias" : "No hay equipos"}
          body={query ? `Nada coincide con «${query}».` : "Un EQUI se crea al identificar una unidad física. No se generan equipos de demostración."}
          action={query ? <TextLink href="/equipos">Quitar búsqueda</TextLink> : can(session.role, "equi.create", session.activeCompanyCode) ? <TextLink href="/equipos/nuevo">Nuevo EQUI</TextLink> : undefined}
        />
      ) : (
        <Table>
          <thead><tr><Th>Folio</Th><Th>Cliente</Th><Th>Identificación</Th><Th>Custodia</Th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td><Link href={`/equipos/${row.id}`} className="font-medium text-[var(--accent)]">{row.folio}</Link></Td>
                <Td>{row.client.name}</Td>
                <Td>{[row.brandName, row.model, row.serial].filter(Boolean).join(" · ")}</Td>
                <Td><Badge>{CUSTODY_LABEL[row.custody as Custody] ?? row.custody}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <ListCap shown={rows.length} />
    </>
  );
}
