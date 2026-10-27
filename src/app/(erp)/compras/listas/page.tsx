import { redirect } from "next/navigation";
import { Badge, Empty, PageHeader, RecordLink, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ListasComprasPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const lists = await prisma.shoppingList.findMany({ where: { companyId: session.activeCompanyId }, include: { supplier: true, _count: { select: { lines: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <><PageHeader back={{ href: "/compras", label: "Compras" }} title="Listas de compras" subtitle="Concentra requerimientos antes de realizar una compra." />
    {lists.length === 0 ? <Empty title="Sin listas de compras" body="Agrega un requerimiento para crear la primera lista." /> : <Table><thead><tr><Th>Folio</Th><Th>Proveedor</Th><Th>Partidas</Th><Th>Estado</Th></tr></thead><tbody>
      {lists.map((list) => <tr key={list.id}><Td><RecordLink href={`/compras/listas/${list.id}`}>{list.folio}</RecordLink></Td><Td>{list.supplier?.name ?? "Sin proveedor"}</Td><Td>{list._count.lines}</Td><Td><Badge>{list.status === "ABIERTA" ? "Abierta" : "Convertida"}</Badge></Td></tr>)}
    </tbody></Table>}
  </>;
}
