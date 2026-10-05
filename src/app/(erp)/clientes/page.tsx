import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
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
        action={can(session.role, "client.create", session.activeCompanyCode) ? <Link href="/clientes/nuevo" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Nuevo cliente</Link> : null}
      />
      <form className="mb-4 flex flex-wrap gap-2" action="/clientes">
        <input name="q" defaultValue={query} placeholder="Nombre o razón social" className="rounded-md border border-[var(--line)] px-3 py-2 text-sm" />
        <select name="estado" defaultValue={estado ?? "activos"} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
        <Button type="submit" tone="ghost">Filtrar</Button>
      </form>
      {clients.length === 0 ? (
        <Empty title="No hay clientes" body="El catálogo de esta empresa está vacío con el filtro actual. El sistema no trae clientes de demostración." />
      ) : (
        <Table>
          <thead><tr><Th>Cliente</Th><Th>Responsable</Th><Th>Crédito</Th><Th>Factura</Th></tr></thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <Td><Link href={`/clientes/${client.id}`} className="font-medium text-[var(--accent)]">{client.name}</Link>{client.isSystem ? " · intercompañía" : ""}</Td>
                <Td>{client.ownerUserId ? ownerName.get(client.ownerUserId) ?? "—" : "—"}</Td>
                <Td>{client.creditDays != null ? `${client.creditDays} días` : "—"}</Td>
                <Td>{client.requiresInvoice == null ? "Sin definir" : client.requiresInvoice ? "Sí" : "No"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
