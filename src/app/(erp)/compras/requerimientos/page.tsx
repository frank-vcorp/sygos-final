import { redirect } from "next/navigation";
import { Empty, PageHeader, RecordLink, Table, Td, Th } from "@/components/ui";
import { RequirementCreateModal } from "./requirement-create-modal";
import { RequirementFilters } from "./requirement-filters";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { can } from "@/lib/permissions";
import { requirementStatusFilter } from "@/lib/requirement-filters";
import { requireCompany } from "@/lib/session";

export default async function ComprasRequerimientosPage({ searchParams }: { searchParams: Promise<{ estado?: string; solicitante?: string; fecha?: string }> }) {
  const session = await requireCompany();
  const canManage = can(session.role, "purchase.operate", session.activeCompanyCode);
  const canCreate = can(session.role, "purchase.requirement.create", session.activeCompanyCode);
  if (!canManage && !canCreate) redirect("/inicio");
  const params = await searchParams;
  const status = requirementStatusFilter(params.estado);
  const rows = await prisma.requirement.findMany({
    where: { companyId: session.activeCompanyId, status, ...(canManage ? (params.solicitante ? { requesterUserId: params.solicitante } : {}) : { requesterUserId: session.userId }), ...(params.fecha ? { createdAt: { gte: new Date(`${params.fecha}T00:00:00`), lt: new Date(`${params.fecha}T23:59:59`) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const groups = [
    { title: "Refacciones", rows: rows.filter((row) => row.kind === "REFACCION") },
    { title: "Generales", rows: rows.filter((row) => row.kind !== "REFACCION") },
  ].filter((group) => group.rows.length);
  return (
    <>
      <PageHeader
        title="Requerimientos"
        subtitle="Solicitudes de compra y refacciones que el gerente convierte en pedido."
        action={canCreate ? <RequirementCreateModal /> : null}
      />
      <RequirementFilters estado={status} solicitante={params.solicitante ?? ""} fecha={params.fecha ?? ""} />
      {rows.length === 0 ? <Empty title={`Sin requerimientos ${status.toLowerCase()}`} body="Crea una solicitud sencilla con número de parte y cantidad." /> : groups.map((group) => (
        <section key={group.title} className="mb-6 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <h2 className="border-b border-[var(--line)] px-4 py-3 text-sm font-semibold">{group.title}</h2>
          <Table><thead><tr><Th>Fecha</Th><Th>Partida</Th><Th>Cantidad</Th><Th>Estado</Th>{canManage ? <Th>Acciones</Th> : null}</tr></thead><tbody>
            {group.rows.map((row) => <tr key={row.id}><Td>{formatWhen(row.createdAt)}</Td><Td><strong>{row.partNumber}</strong>{row.description ? <span className="block text-sm text-[var(--muted)]">{row.description}</span> : null}</Td><Td>{row.quantity}</Td><Td>{row.status === "EN_LISTA" ? "En lista" : row.status}</Td>{canManage ? <Td className="flex gap-2">{row.status === "PENDIENTE" ? <><RecordLink href={`/compras/requerimientos/${row.id}/comprar`}>Comprar</RecordLink><RecordLink href={`/compras/requerimientos/${row.id}/agregar-a-lista`}>Agregar a lista</RecordLink></> : row.shoppingListId ? <RecordLink href={`/compras/listas/${row.shoppingListId}`}>Ver lista</RecordLink> : row.purchaseId ? <RecordLink href={`/compras/${row.purchaseId}`}>Ver compra</RecordLink> : null}</Td> : null}</tr>)}
          </tbody></Table>
        </section>
      ))}
    </>
  );
}
