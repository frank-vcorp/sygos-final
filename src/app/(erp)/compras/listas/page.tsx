import { redirect } from "next/navigation";
import { ActiveFilters, Badge, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th } from "@/components/ui";
import { ShoppingListFilters } from "./shopping-list-filters";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { shoppingListHref } from "@/lib/purchase-filter-links";
import { shoppingListStatusFilter } from "@/lib/purchases";
import { requireCompany } from "@/lib/session";

export default async function ListasComprasPage({ searchParams }: { searchParams: Promise<{ estado?: string; proveedor?: string; fecha?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const params = await searchParams;
  const status = shoppingListStatusFilter(params.estado);
  const dateFilter = params.fecha ? { gte: new Date(`${params.fecha}T00:00:00`), lt: new Date(`${params.fecha}T23:59:59`) } : undefined;
  const [lists, suppliers] = await Promise.all([
    prisma.shoppingList.findMany({ where: { companyId: session.activeCompanyId, ...(status ? { status } : {}), ...(params.proveedor ? { supplierId: params.proveedor } : {}), ...(dateFilter ? { createdAt: dateFilter } : {}) }, include: { supplier: true, _count: { select: { lines: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const emptyTitle = status === "ABIERTA" ? "Sin listas abiertas" : status === "CONVERTIDA" ? "Sin listas convertidas" : "Sin listas de compras";
  const filters = (omit?: "estado" | "proveedor" | "fecha") => shoppingListHref({
    estado: omit === "estado" ? undefined : params.estado ?? "ABIERTA",
    proveedor: omit === "proveedor" ? undefined : params.proveedor,
    fecha: omit === "fecha" ? undefined : params.fecha,
  });
  return <><PageHeader back={{ href: "/compras", label: "Compras" }} title="Listas de compras" subtitle="Concentra requerimientos antes de realizar una compra." />
    <ShoppingListFilters estado={params.estado ?? "ABIERTA"} proveedor={params.proveedor ?? ""} fecha={params.fecha ?? ""} suppliers={suppliers} />
    <ActiveFilters items={[
      ...(params.estado === "CONVERTIDA" ? [{ label: "Convertidas", clearHref: filters("estado") }] : []),
      ...(params.proveedor ? [{ label: `Proveedor: ${suppliers.find((supplier) => supplier.id === params.proveedor)?.name ?? "Seleccionado"}`, clearHref: filters("proveedor") }] : []),
      ...(params.fecha ? [{ label: `Fecha: ${params.fecha}`, clearHref: filters("fecha") }] : []),
    ]} />
    {lists.length === 0 ? <Empty title={emptyTitle} body="Agrega un requerimiento para crear la primera lista." /> : <ResponsiveData table={<Table><thead><tr><Th>Folio</Th><Th>Proveedor</Th><Th>Partidas</Th><Th>Estado</Th></tr></thead><tbody>
      {lists.map((list) => <tr key={list.id}><Td><RecordLink href={`/compras/listas/${list.id}`}>{list.folio}</RecordLink></Td><Td>{list.supplier?.name ?? "Sin proveedor"}</Td><Td>{list._count.lines}</Td><Td><Badge>{list.status === "ABIERTA" ? "Abierta" : "Convertida"}</Badge></Td></tr>)}
    </tbody></Table>} cards={lists.map((list) => <MobileCard key={list.id} href={`/compras/listas/${list.id}`} title={list.folio} meta={<Badge>{list.status === "ABIERTA" ? "Abierta" : "Convertida"}</Badge>}><p>{list.supplier?.name ?? "Sin proveedor"}</p><p>{list._count.lines} partidas</p></MobileCard>)} />}
  </>;
}
