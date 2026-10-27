import { redirect } from "next/navigation";
import { Button, controlClass, Empty, PageHeader, RecordLink, Table, Td, Th } from "@/components/ui";
import { RequirementCreateModal } from "./requirement-create-modal";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ComprasRequerimientosPage({ searchParams }: { searchParams: Promise<{ estado?: string; solicitante?: string; fecha?: string }> }) {
  const session = await requireCompany();
  const canManage = can(session.role, "purchase.operate", session.activeCompanyCode);
  const canCreate = can(session.role, "purchase.requirement.create", session.activeCompanyCode);
  if (!canManage && !canCreate) redirect("/inicio");
  const params = await searchParams;
  const status = params.estado && ["PENDIENTE", "EN_LISTA", "ATENDIDO", "CANCELADO"].includes(params.estado) ? params.estado : "PENDIENTE";
  const rows = await prisma.requirement.findMany({
    where: { companyId: session.activeCompanyId, status, ...(canManage || !canCreate ? {} : { requesterUserId: session.userId }), ...(params.solicitante ? { requesterUserId: params.solicitante } : {}), ...(params.fecha ? { createdAt: { gte: new Date(`${params.fecha}T00:00:00`), lt: new Date(`${params.fecha}T23:59:59`) } } : {}) },
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
      <form action="/compras/requerimientos" className="mb-6 grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-4">
        <select name="estado" defaultValue={status} className={controlClass}><option value="PENDIENTE">Pendientes</option><option value="EN_LISTA">En lista</option><option value="ATENDIDO">Atendidos</option><option value="CANCELADO">Cancelados</option></select>
        <input name="solicitante" placeholder="Solicitante" defaultValue={params.solicitante ?? ""} className={controlClass} />
        <input name="fecha" type="date" defaultValue={params.fecha ?? ""} className={controlClass} />
        <Button type="submit" tone="ghost">Filtrar</Button>
      </form>
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
