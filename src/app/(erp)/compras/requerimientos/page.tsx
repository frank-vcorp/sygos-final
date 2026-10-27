import { redirect } from "next/navigation";
import { Button, controlClass, Empty, Field, FormActions, FormPanel, FormSection, PageHeader, Table, Td, Th } from "@/components/ui";
import { createRequirementAction, importTechnicalRequirementAction, requirementStatusAction } from "../actions";
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
  const status = params.estado && ["PENDIENTE", "ATENDIDO", "CANCELADO"].includes(params.estado) ? params.estado : "PENDIENTE";
  const rows = await prisma.requirement.findMany({
    where: { companyId: session.activeCompanyId, status, ...(canManage || !canCreate ? {} : { requesterUserId: session.userId }), ...(params.solicitante ? { requesterUserId: params.solicitante } : {}), ...(params.fecha ? { createdAt: { gte: new Date(`${params.fecha}T00:00:00`), lt: new Date(`${params.fecha}T23:59:59`) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const technical = canManage && status === "PENDIENTE" ? await Promise.all([
    prisma.partRequest.findMany({ where: { companyId: session.activeCompanyId, status: "SOLICITADA" }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.partPresolicitud.findMany({ where: { companyId: session.activeCompanyId, status: "ACTIVA" }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]) : [[], []] as const;

  return (
    <>
      <PageHeader
        title="Requerimientos"
        subtitle="Solicitudes de compra y refacciones que el gerente convierte en pedido."
        action={canCreate ? <a href="#nuevo-requerimiento" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white">Nuevo requerimiento</a> : null}
      />
      <form action="/compras/requerimientos" className="mb-6 grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-4">
        <select name="estado" defaultValue={status} className={controlClass}><option value="PENDIENTE">Pendientes</option><option value="ATENDIDO">Atendidos</option><option value="CANCELADO">Cancelados</option></select>
        <input name="solicitante" placeholder="Solicitante" defaultValue={params.solicitante ?? ""} className={controlClass} />
        <input name="fecha" type="date" defaultValue={params.fecha ?? ""} className={controlClass} />
        <Button type="submit" tone="ghost">Filtrar</Button>
      </form>
      {rows.length === 0 ? <Empty title={`Sin requerimientos ${status.toLowerCase()}`} body="Crea una solicitud sencilla con número de parte y cantidad." /> : (
        <Table><thead><tr><Th>Fecha</Th><Th>Partida</Th><Th>Cantidad</Th><Th>Estado</Th>{canManage ? <Th>Acciones</Th> : null}</tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}><Td>{formatWhen(row.createdAt)}</Td><Td><strong>{row.partNumber}</strong>{row.description ? <span className="block text-sm text-[var(--muted)]">{row.description}</span> : null}</Td><Td>{row.quantity}</Td><Td>{row.status}</Td>{canManage ? <Td><form action={requirementStatusAction} className="flex gap-2"><input type="hidden" name="requirementId" value={row.id} /><input type="hidden" name="status" value="ATENDIDO" /><Button type="submit" tone="ghost">Atendido</Button></form></Td> : null}</tr>)}
        </tbody></Table>
      )}
      {canManage && status === "PENDIENTE" && (technical[0].length > 0 || technical[1].length > 0) ? <section className="mt-8"><h2 className="mb-3 text-lg font-semibold">Solicitudes técnicas pendientes</h2><div className="space-y-2">{[...technical[0].map((item) => ({ ...item, sourceType: "OS" as const })), ...technical[1].map((item) => ({ ...item, sourceType: "DX" as const }))].map((item) => <div key={`${item.sourceType}-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4"><div><strong>{item.partNumber}</strong> · {item.description}<span className="ml-2 text-sm text-[var(--muted)]">{item.qtyRequested} piezas · {item.sourceType}</span></div><form action={importTechnicalRequirementAction}><input type="hidden" name="sourceType" value={item.sourceType} /><input type="hidden" name="sourceId" value={item.id} /><Button type="submit" tone="ghost">+ Agregar a requerimientos</Button></form></div>)}</div></section> : null}
      {canCreate ? <FormPanel id="nuevo-requerimiento" action={createRequirementAction} className="mt-8 scroll-mt-24"><FormSection title="Nuevo requerimiento" description="El solicitante solo indica qué necesita y cuántas piezas."><Field label="Número de parte"><input name="partNumber" required className={controlClass} /></Field><Field label="Descripción"><input name="description" className={controlClass} /></Field><Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue="1" required className={controlClass} /></Field></FormSection><FormActions><Button type="submit">Guardar requerimiento</Button></FormActions></FormPanel> : null}
    </>
  );
}
