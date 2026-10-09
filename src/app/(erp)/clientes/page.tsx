import { redirect } from "next/navigation";
import { ClientesFilter } from "@/components/clientes-filter";
import { ActionLink, ActiveFilters, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th, TextLink } from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { clientMatchesQuery, PREVIEW_LIMIT, SEARCH_LIMIT } from "@/lib/client-search";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "client.edit", session.activeCompanyCode) && !can(session.role, "client.create", session.activeCompanyCode)) {
    redirect("/inicio");
  }
  const { q, estado } = await searchParams;
  const query = (q ?? "").trim();
  const estadoFilter = estado === "inactivos" ? "inactivos" : "activos";
  const baseWhere = {
    companyId: session.activeCompanyId,
    ...(estadoFilter === "inactivos" ? { active: false, isSystem: false } : { active: true, isSystem: false }),
    ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}),
  };

  const totalInCatalog = await prisma.client.count({ where: baseWhere });

  let clients: Awaited<ReturnType<typeof prisma.client.findMany>>;
  let searchTruncated = false;
  let matchCount = 0;

  if (query) {
    const pool = await prisma.client.findMany({
      where: baseWhere,
      orderBy: { name: "asc" },
    });
    const matched = pool.filter((client) => clientMatchesQuery(client.name, client.rfc, query));
    matchCount = matched.length;
    searchTruncated = matchCount > SEARCH_LIMIT;
    clients = matched.slice(0, SEARCH_LIMIT);
  } else {
    clients = await prisma.client.findMany({
      where: baseWhere,
      orderBy: { name: "asc" },
      take: PREVIEW_LIMIT,
    });
  }
  const owners = await prisma.user.findMany({
    where: { id: { in: clients.map((client) => client.ownerUserId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, name: true },
  });
  const ownerName = new Map(owners.map((owner) => [owner.id, owner.name]));
  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={
          query
            ? `${searchTruncated ? `${SEARCH_LIMIT}+` : matchCount} coincidencias · ${session.activeCompanyName ?? ""}`
            : `${totalInCatalog} en catálogo · mostrando ${Math.min(clients.length, PREVIEW_LIMIT)} · ${session.activeCompanyName ?? ""}`
        }
        action={can(session.role, "client.create", session.activeCompanyCode) ? <ActionLink href="/clientes/nuevo">Nuevo cliente</ActionLink> : null}
      />
      <ClientesFilter query={query} estado={estadoFilter} />
      <ActiveFilters
        items={[
          ...(estadoFilter === "inactivos" ? [{ label: "Inactivos", clearHref: listHref("/clientes", { q: query || undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: listHref("/clientes", { estado: estadoFilter === "inactivos" ? "inactivos" : undefined }) }] : []),
        ]}
      />
      {clients.length === 0 ? (
        <Empty
          title={query || estado === "inactivos" ? "Sin coincidencias" : "No hay clientes"}
          body={query || estado === "inactivos" ? "Nada coincide con el filtro. El sistema no trae clientes de demostración." : "El catálogo de esta empresa está vacío. El sistema no trae clientes de demostración."}
          action={query || estado === "inactivos" ? <TextLink href="/clientes">Quitar filtro</TextLink> : can(session.role, "client.create", session.activeCompanyCode) ? <TextLink href="/clientes/nuevo">Nuevo cliente</TextLink> : undefined}
        />
      ) : (
        <ResponsiveData
          table={<Table><thead><tr><Th>Cliente</Th><Th>Responsable</Th><Th>Crédito</Th><Th>Factura</Th></tr></thead><tbody>{clients.map((client) => <tr key={client.id}><Td><RecordLink href={`/clientes/${client.id}`}>{client.name}</RecordLink>{client.isSystem ? " · intercompañía" : ""}</Td><Td>{client.ownerUserId ? ownerName.get(client.ownerUserId) ?? "—" : "—"}</Td><Td>{client.creditDays != null ? `${client.creditDays} días` : "—"}</Td><Td>{client.requiresInvoice == null ? "Sin definir" : client.requiresInvoice ? "Sí" : "No"}</Td></tr>)}</tbody></Table>}
          cards={clients.map((client) => <MobileCard key={client.id} href={`/clientes/${client.id}`} title={client.name} meta={client.isSystem ? "Intercompañía" : undefined}><p>Responsable: {client.ownerUserId ? ownerName.get(client.ownerUserId) ?? "—" : "—"}</p><p>Crédito: {client.creditDays != null ? `${client.creditDays} días` : "—"} · Factura: {client.requiresInvoice == null ? "Sin definir" : client.requiresInvoice ? "Sí" : "No"}</p></MobileCard>)}
        />
      )}
      {!query && totalInCatalog > PREVIEW_LIMIT ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Mostrando los primeros {PREVIEW_LIMIT} por orden alfabético. Escribe en el buscador para encontrar cualquier cliente del catálogo ({totalInCatalog}).
        </p>
      ) : null}
      {query && searchTruncated ? (
        <p className="mt-2 text-xs text-[var(--muted)]">Hay más de {SEARCH_LIMIT} coincidencias; acota el texto de búsqueda.</p>
      ) : null}
    </>
  );
}
