import Link from "next/link";
import { notFound } from "next/navigation";
import { AttentionForm, CancelMovementForm, MovementForm } from "@/components/custody-forms";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui";
import { CUSTODY_LABEL, MOVEMENT_LABEL, type Custody, type MovementKind } from "@/lib/custody";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { requireCompany } from "@/lib/session";

export async function EquipmentDetail({ id, expectedKind }: { id: string; expectedKind: "EQUI" | "MOT" }) {
  const session = await requireCompany();
  const allowed = expectedKind === "EQUI"
    ? can(session.role, "equi.view", session.activeCompanyCode)
    : can(session.role, "mot.view", session.activeCompanyCode);
  if (!allowed) notFound();
  const systron = await prisma.company.findUnique({ where: { code: "SYSTRON" } });
  const equipment = await prisma.equipment.findFirst({
    where: {
      id,
      kind: expectedKind,
      ...(expectedKind === "EQUI" ? { originCompanyId: session.activeCompanyId } : {}),
      ...(expectedKind === "MOT" && session.activeCompanyCode === "SYSTRON" ? { originCompanyId: session.activeCompanyId } : {}),
      ...(expectedKind === "MOT" && session.activeCompanyCode === "SERVOMOTORES"
        ? { OR: [{ originCompanyId: session.activeCompanyId }, ...(systron ? [{ originCompanyId: systron.id }] : [])] }
        : {}),
      ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}),
    },
    include: {
      client: true,
      originCompany: true,
      attentions: { orderBy: { createdAt: "desc" }, include: { adminClient: true, technicalCases: true } },
      movements: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!equipment) notFound();
  const intercompany = expectedKind === "MOT" && session.activeCompanyCode === "SERVOMOTORES" && equipment.originCompany.code === "SYSTRON";
  const seller = equipment.attentions.find((row) => row.sellerUserId)?.sellerUserId;
  const sellerUser = seller ? await prisma.user.findUnique({ where: { id: seller } }) : null;
  const suppliers = can(session.role, "custody.confirm", session.activeCompanyCode)
    ? await prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true, isSystem: false }, orderBy: { name: "asc" } })
    : [];
  const repairs = await prisma.technicalCase.findMany({
    where: { equipmentId: equipment.id, kind: "OS", status: "TERMINADA", paidAt: { not: null }, spawnedFromId: null },
    select: { id: true, folio: true },
  });
  const priorities = equipment.originCompanyId === session.activeCompanyId
    ? await prisma.priority.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { sortOrder: "asc" } })
    : [];
  const history = await historyFor("EQUIPO", equipment.id);
  const users = await prisma.user.findMany({
    where: { id: { in: equipment.movements.map((row) => row.authorUserId) } },
    select: { id: true, name: true },
  });
  const names = new Map(users.map((user) => [user.id, user.name]));
  const canMove = can(session.role, "custody.confirm", session.activeCompanyCode)
    && ((expectedKind === "EQUI" && session.activeCompanyCode === "SYSTRON") || (expectedKind === "MOT" && session.activeCompanyCode === "SERVOMOTORES"));
  const canAttend = equipment.originCompanyId === session.activeCompanyId && can(session.role, "attention.create", session.activeCompanyCode);
  const latestOpen = equipment.movements.find((row) => !row.cancelledAt);

  return (
    <>
      <PageHeader
        title={equipment.folio}
        subtitle={expectedKind === "EQUI" ? "Identidad física EQUI" : "Identidad física MOT"}
        action={<Badge>{CUSTODY_LABEL[equipment.custody as Custody] ?? equipment.custody}</Badge>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
            <p>Origen: {equipment.originCompany.name}</p>
            <p className="mt-1">Cliente: {intercompany ? "SYSTRON, cliente administrativo. El cliente final no se muestra en Servomotores." : can(session.role, "client.edit", session.activeCompanyCode) ? <Link href={`/clientes/${equipment.client.id}`} className="text-[var(--accent)]">{equipment.client.name}</Link> : equipment.client.name}</p>
            {intercompany && sellerUser ? <p className="mt-1">Contacto operativo SYSTRON: {sellerUser.name}</p> : null}
            <p className="mt-1">Identificación: {[equipment.typeName, equipment.brandName, equipment.model].filter(Boolean).join(" · ")}</p>
            {equipment.serial ? <p className="mt-1">Serie: {equipment.serial}</p> : null}
            {equipment.description ? <p className="mt-1">{equipment.description}</p> : null}
            {expectedKind === "MOT" && session.activeCompanyCode === "SYSTRON" ? (
              <p className="mt-3 text-[var(--muted)]">Este MOT no entra al almacén SYSTRON. El estado físico lo confirma Servomotores.</p>
            ) : null}
          </section>
          <section>
            <h2 className="mb-2 font-medium">Atenciones</h2>
            {equipment.attentions.length === 0 ? <p className="text-sm text-[var(--muted)]">Todavía no hay un episodio de servicio.</p> : (
              <ul className="space-y-2">
                {equipment.attentions.map((attention) => (
                  <li key={attention.id} className="rounded-lg border border-[var(--line)] bg-white p-3 text-sm">
                    <p className="font-medium">
                      {ATTENTION_LABEL[attention.attentionType as AttentionType] ?? attention.attentionType} · {attention.priorityName}
                      {attention.technicalCases.map((item) => (
                        <Link key={item.id} href={`/operacion/${item.id}`} className="ml-2 text-[var(--accent)]">{item.folio}</Link>
                      ))}
                    </p>
                    <p className="mt-1">{attention.reportedFault}</p>
                    <p className="mt-1 text-[var(--muted)]">
                      {attention.status === "ABIERTA" ? "SLA aún no inicia." : `SLA iniciado ${attention.slaStartedAt ? formatWhen(attention.slaStartedAt) : ""}.`}
                      {attention.antecedent ? ` Antecedente: ${attention.antecedent}.` : ""}
                    </p>
                    {attention.deliveryInstructions ? <p className="mt-1">Entrega: {attention.deliveryInstructions}</p> : null}
                    {intercompany ? <p className="mt-1">Cliente administrativo: {attention.adminClient.name}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="mb-2 font-medium">Movimientos físicos</h2>
            {equipment.movements.length === 0 ? <p className="text-sm text-[var(--muted)]">Sin movimientos.</p> : (
              <Table>
                <thead><tr><Th>Cuándo</Th><Th>Movimiento</Th><Th>Detalle</Th><Th>Autor</Th></tr></thead>
                <tbody>
                  {equipment.movements.map((movement) => (
                    <tr key={movement.id}>
                      <Td>{formatWhen(movement.occurredAt)}</Td>
                      <Td>
                        {MOVEMENT_LABEL[movement.kind as MovementKind] ?? movement.kind}
                        {movement.cancelledAt ? " · cancelado" : ""}
                      </Td>
                      <Td>
                        {movement.reason}
                        {movement.receiverName ? ` · recibe ${movement.receiverName}` : ""}
                        {movement.enablingDocument ? ` · ${movement.enablingDocument}` : ""}
                        {movement.cancelReason ? ` · ${movement.cancelReason}` : ""}
                        {canMove && latestOpen?.id === movement.id && movement.kind !== "ENTRADA" && movement.kind !== "INGRESO" && !movement.cancelledAt ? (
                          <CancelMovementForm equipmentId={equipment.id} kind={expectedKind} movementId={movement.id} />
                        ) : null}
                      </Td>
                      <Td>{names.get(movement.authorUserId) ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        </div>
        <div className="space-y-4">
          {canMove ? (
            <MovementForm
              equipmentId={equipment.id}
              kind={expectedKind}
              custody={equipment.custody as Custody}
              version={equipment.version}
              suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
            />
          ) : null}
          {canAttend ? <AttentionForm equipmentId={equipment.id} kind={expectedKind} version={equipment.version} priorities={priorities} repairs={repairs} /> : null}
          <section className="rounded-lg border border-[var(--line)] bg-white p-4">
            <h2 className="font-medium">Historial</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {history.map((row) => (
                <li key={row.id}><span className="text-[var(--muted)]">{formatWhen(row.createdAt)}</span> · {row.summary}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
