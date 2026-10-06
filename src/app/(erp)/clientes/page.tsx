import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionLink, Button, controlClass, Empty, FilterBar, ListCap, MobileCard, PageHeader, ResponsiveData, Table, Td, Th, TextLink } from "@/components/ui";
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
  const clients = await prisma.client.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...(estado === "inactivos" ? { active: false, isSystem: false } : { active: true }),
      ...(session.role === "VENTAS" ? { ownerUserId: session.userId } : {}),
      ...(query ? { name: { contains: query } } : {}),
    },
    orderBy: { name: "asc" },
    take: 100,
  });
  const owners = await prisma.user.findMany({
    where: { id: { in: clients.map((client) => client.ownerUserId).filter((id): id is string => Boolean(id)) } },
    select: { id: true, name: true },
  });
  const ownerName = new Map(owners.map((owner) => [owner.id, owner.name]));
  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle={session.activeCompanyName ?? ""}
        action={can(session.role, "client.create", session.activeCompanyCode) ? <ActionLink href="/clientes/nuevo">Nuevo cliente</ActionLink> : null}
      />
      <FilterBar action="/clientes">
        <input name="q" defaultValue={query} placeholder="Nombre o razón social" className={`${controlClass} sm:flex-1`} />
        <select name="estado" defaultValue={estado ?? "activos"} className={`${controlClass} sm:w-auto`}>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <Button type="submit" tone="ghost">Filtrar</Button>
      </FilterBar>
      {clients.length === 0 ? (
        <Empty
          title={query || estado === "inactivos" ? "Sin coincidencias" : "No hay clientes"}
          body={query || estado === "inactivos" ? "Nada coincide con el filtro. El sistema no trae clientes de demostración." : "El catálogo de esta empresa está vacío. El sistema no trae clientes de demostración."}
          action={query || estado === "inactivos" ? <TextLink href="/clientes">Quitar filtro</TextLink> : can(session.role, "client.create", session.activeCompanyCode) ? <TextLink href="/clientes/nuevo">Nuevo cliente</TextLink> : undefined}
        />
      ) : (
        <ResponsiveData
          table={<Table><thead><tr><Th>Cliente</Th><Th>Responsable</Th><Th>Crédito</Th><Th>Factura</Th></tr></thead><tbody>{clients.map((client) => <tr key={client.id}><Td><Link href={`/clientes/${client.id}`} className="font-medium text-[var(--accent)]">{client.name}</Link>{client.isSystem ? " · intercompañía" : ""}</Td><Td>{client.ownerUserId ? ownerName.get(client.ownerUserId) ?? "—" : "—"}</Td><Td>{client.creditDays != null ? `${client.creditDays} días` : "—"}</Td><Td>{client.requiresInvoice == null ? "Sin definir" : client.requiresInvoice ? "Sí" : "No"}</Td></tr>)}</tbody></Table>}
          cards={clients.map((client) => <MobileCard key={client.id} href={`/clientes/${client.id}`} title={client.name} meta={client.isSystem ? "Intercompañía" : undefined}><p>Responsable: {client.ownerUserId ? ownerName.get(client.ownerUserId) ?? "—" : "—"}</p><p>Crédito: {client.creditDays != null ? `${client.creditDays} días` : "—"} · Factura: {client.requiresInvoice == null ? "Sin definir" : client.requiresInvoice ? "Sí" : "No"}</p></MobileCard>)}
        />
      )}
      <ListCap shown={clients.length} />
    </>
  );
}
