import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { ActionLink, Badge, Button, controlClass, Empty, FilterBar, ListCap, MobileCard, PageHeader, ResponsiveData, Table, Td, Th, TextLink } from "@/components/ui";
import { CUSTODY_LABEL, type Custody } from "@/lib/custody";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function EquiposPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "equipment.catalog", session.activeCompanyCode)) redirect("/panel");
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
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
    include: { client: { select: { id: true, name: true, isSystem: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        title="Equipos"
        subtitle="Identidad EQUI de SYSTRON. El folio no se reutiliza."
        action={can(session.role, "equi.create", session.activeCompanyCode) ? <ActionLink href="/equipos/nuevo">Nuevo EQUI</ActionLink> : null}
      />
      <FilterBar action="/equipos">
        <input name="q" defaultValue={query} placeholder="Folio, modelo, serie o cliente" className={`${controlClass} sm:flex-1`} />
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      {rows.length === 0 ? (
        <Empty
          title={query ? "Sin coincidencias" : "No hay equipos"}
          body={query ? `Nada coincide con «${query}».` : "Un EQUI se crea al identificar una unidad física. No se generan equipos de demostración."}
          action={query ? <TextLink href="/equipos">Quitar búsqueda</TextLink> : can(session.role, "equi.create", session.activeCompanyCode) ? <TextLink href="/equipos/nuevo">Nuevo EQUI</TextLink> : undefined}
        />
      ) : (
        <ResponsiveData
          table={<Table><thead><tr><Th>Folio</Th><Th>Cliente</Th><Th>Identificación</Th><Th>Custodia</Th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><Td><Link href={`/equipos/${row.id}`} className="font-medium text-[var(--accent)]">{row.folio}</Link></Td><Td><ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} /></Td><Td>{[row.brandName, row.model, row.serial].filter(Boolean).join(" · ")}</Td><Td><Badge>{CUSTODY_LABEL[row.custody as Custody] ?? row.custody}</Badge></Td></tr>)}</tbody></Table>}
          cards={rows.map((row) => (
            <MobileCard
              key={row.id}
              href={`/equipos/${row.id}`}
              title={row.folio}
              meta={<Badge>{CUSTODY_LABEL[row.custody as Custody] ?? row.custody}</Badge>}
              footer={<ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />}
            >
              <p>{[row.brandName, row.model, row.serial].filter(Boolean).join(" · ") || "Sin identificación adicional"}</p>
            </MobileCard>
          ))}
        />
      )}
      <ListCap shown={rows.length} />
    </>
  );
}
