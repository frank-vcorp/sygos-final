import { redirect } from "next/navigation";
import { Badge, Button, controlClass, Empty, PageHeader, RecordLink, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { shoppingListStatusFilter } from "@/lib/purchases";
import { requireCompany } from "@/lib/session";

export default async function ListasComprasPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const params = await searchParams;
  const status = shoppingListStatusFilter(params.estado);
  const lists = await prisma.shoppingList.findMany({ where: { companyId: session.activeCompanyId, ...(status ? { status } : {}) }, include: { supplier: true, _count: { select: { lines: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  const emptyTitle = status === "ABIERTA" ? "Sin listas abiertas" : status === "CONVERTIDA" ? "Sin listas convertidas" : "Sin listas de compras";
  return <><PageHeader back={{ href: "/compras", label: "Compras" }} title="Listas de compras" subtitle="Concentra requerimientos antes de realizar una compra." />
    <form action="/compras/listas" className="mb-6 flex flex-wrap gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <select name="estado" defaultValue={status ?? "TODAS"} className={controlClass} aria-label="Estado de lista de compras"><option value="ABIERTA">Listas abiertas</option><option value="CONVERTIDA">Listas convertidas en compra</option><option value="TODAS">Todas las listas</option></select>
      <Button type="submit" tone="ghost">Filtrar</Button>
    </form>
    {lists.length === 0 ? <Empty title={emptyTitle} body="Agrega un requerimiento para crear la primera lista." /> : <Table><thead><tr><Th>Folio</Th><Th>Proveedor</Th><Th>Partidas</Th><Th>Estado</Th></tr></thead><tbody>
      {lists.map((list) => <tr key={list.id}><Td><RecordLink href={`/compras/listas/${list.id}`}>{list.folio}</RecordLink></Td><Td>{list.supplier?.name ?? "Sin proveedor"}</Td><Td>{list._count.lines}</Td><Td><Badge>{list.status === "ABIERTA" ? "Abierta" : "Convertida"}</Badge></Td></tr>)}
    </tbody></Table>}
  </>;
}
