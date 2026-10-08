import Link from "next/link";
import { ClientNameLink } from "@/components/client-entity-links";
import { notFound } from "next/navigation";
import { AttentionForm, CancelMovementForm, MovementForm } from "@/components/custody-forms";
import { EquipmentCustodyActions } from "@/components/equipment-custody-actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { Badge, PageHeader, Table, Td, Th } from "@/components/ui";
import { allowedMovements, CUSTODY_LABEL, isInitialWarehouseReceipt, isReceipt, MOVEMENT_LABEL, receiptReasonFromAttention, type Custody, type MovementKind } from "@/lib/custody";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { openPendingCases } from "@/lib/technical";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export async function EquipmentDetail({ id, expectedKind }: { id: string; expectedKind: "EQUI" | "MOT" }) {
  const session = await requireCompany();
  const custodyDetail =
    can(session.role, "custody.confirm", session.activeCompanyCode)
    && ((expectedKind === "EQUI" && session.activeCompanyCode === "SYSTRON")
      || (expectedKind === "MOT" && session.activeCompanyCode === "SERVOMOTORES"));
  const allowed = expectedKind === "EQUI"
    ? can(session.role, "equi.view", session.activeCompanyCode) || custodyDetail
    : can(session.role, "mot.view", session.activeCompanyCode) || custodyDetail;
  if (!allowed) notFound();
  const mayEquiList =
    can(session.role, "equi.view", session.activeCompanyCode)
    && (session.role === "VENTAS" || can(session.role, "equipment.catalog", session.activeCompanyCode));
  const mayMotList = can(session.role, "equipment.catalog", session.activeCompanyCode) && can(session.role, "mot.view", session.activeCompanyCode);
  const listHref = expectedKind === "EQUI" ? (mayEquiList ? "/equipos" : "/custodia") : (mayMotList ? "/motores" : "/custodia");
  try {
    await openPendingCases(id, new Date());
  } catch {
    // La ficha sigue mostrando la custodia si el diagnóstico no pudo abrirse.
  }
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
    },
    include: {
      client: true,
      originCompany: true,
      attentions: { orderBy: { createdAt: "desc" }, include: { adminClient: true, technicalCases: true } },
      movements: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!equipment) notFound();
  await redirectIfSalesNotAssigned(session, equipment.client.ownerUserId, expectedKind === "EQUI" ? "/equipos" : "/motores");
  if (session.role === "TECNICO") {
    const linked = await prisma.technicalCase.findFirst({
      where: {
        equipmentId: equipment.id,
        OR: [{ assigneeUserId: session.userId }, { finishedByUserId: session.userId }],
      },
    });
    if (!linked) notFound();
  }
  const intercompany = expectedKind === "MOT" && session.activeCompanyCode === "SERVOMOTORES" && equipment.originCompany.code === "SYSTRON";
  const seller = equipment.attentions.find((row) => row.sellerUserId)?.sellerUserId;
  const sellerUser = seller ? await prisma.user.findUnique({ where: { id: seller } }) : null;
  const suppliers = can(session.role, "custody.confirm", session.activeCompanyCode)
    ? await prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true, isSystem: false }, orderBy: { name: "asc" } })
    : [];
  const repairs = await prisma.technicalCase.findMany({
    where: { equipmentId: equipment.id, kind: "OS", status: "TERMINADA", paidAt: { not: null }, attention: { attentionType: { not: "DIAGNOSTICO_GARANTIA" } } },
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
  const movementOptions = allowedMovements(expectedKind, equipment.custody as Custody);
  const openAttention = equipment.attentions.find((row) => row.status === "ABIERTA");
  const receiptMovement = movementOptions.find((movement) => isReceipt(movement));
  const receiptReason = openAttention ? receiptReasonFromAttention(openAttention.attentionType) : null;
  const simplifiedReceipt =
    receiptMovement
    && receiptReason
    && isInitialWarehouseReceipt(expectedKind, equipment.custody as Custody, receiptMovement);
  const awaitingAttentionForReceipt =
    receiptMovement
    && isInitialWarehouseReceipt(expectedKind, equipment.custody as Custody, receiptMovement)
    && !openAttention;

  return (
    <>
      <PageHeader
        back={{ href: listHref, label: listHref === "/custodia" ? "Almacén" : expectedKind === "EQUI" ? "Equipos" : "Motores" }}
        title={equipment.folio}
        subtitle={expectedKind === "EQUI" ? "Identidad física EQUI" : "Identidad física MOT"}
        action={<Badge>{CUSTODY_LABEL[equipment.custody as Custody] ?? equipment.custody}</Badge>}
      />
      <div className="space-y-6">
        <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
          <p>Origen: {equipment.originCompany.name}</p>
          <p className="mt-1">Cliente: {intercompany ? "SYSTRON, cliente administrativo. El cliente final no se muestra en Servomotores." : <ClientNameLink clientId={equipment.client.id} name={equipment.client.name} isSystem={equipment.client.isSystem} canEdit={can(session.role, "client.edit", session.activeCompanyCode)} />}</p>
          {intercompany && sellerUser ? <p className="mt-1">Contacto operativo SYSTRON: {sellerUser.name}</p> : null}
          <p className="mt-1">Identificación: {[equipment.typeName, equipment.brandName, equipment.model].filter(Boolean).join(" · ")}</p>
          {equipment.serial ? <p className="mt-1">Serie: {equipment.serial}</p> : null}
          {equipment.description ? <p className="mt-1">{equipment.description}</p> : null}
          {expectedKind === "MOT" && session.activeCompanyCode === "SYSTRON" ? (
            <p className="mt-3 text-[var(--muted)]">Este MOT no entra al almacén SYSTRON. El estado físico lo confirma Servomotores.</p>
          ) : null}
        </section>

        {awaitingAttentionForReceipt ? (
          <p className="rounded-md border border-[#efd0d0] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
            Falta la atención de ventas (diagnóstico o reparación) antes de confirmar la entrada física.
          </p>
        ) : null}
        <EquipmentCustodyActions
          showMovement={canMove && movementOptions.length > 0 && !awaitingAttentionForReceipt}
          showAttention={canAttend}
          movementButtonLabel={simplifiedReceipt ? "Confirmar entrada física" : "Registrar movimiento"}
          movementTitle={simplifiedReceipt ? "Confirmar entrada física" : "Registrar movimiento"}
          movement={
            <MovementForm
              variant="plain"
              equipmentId={equipment.id}
              equipmentFolio={equipment.folio}
              kind={expectedKind}
              custody={equipment.custody as Custody}
              version={equipment.version}
              suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
              allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
              receiptPreset={simplifiedReceipt && receiptMovement && openAttention && receiptReason ? {
                movement: receiptMovement,
                reason: receiptReason,
                serviceLabel: ATTENTION_LABEL[openAttention.attentionType as AttentionType] ?? openAttention.attentionType,
                reportedFault: openAttention.reportedFault,
                clientName: intercompany ? "SYSTRON · intercompañía" : equipment.client.name,
              } : undefined}
            />
          }
          attention={
            <AttentionForm
              variant="plain"
              equipmentId={equipment.id}
              kind={expectedKind}
              version={equipment.version}
              priorities={priorities}
              repairs={repairs}
            />
          }
        />

        <section>
            <h2 className="mb-2 font-medium">Atenciones</h2>
            {equipment.attentions.length === 0 ? <p className="text-sm text-[var(--muted)]">Todavía no hay un episodio de servicio.</p> : (
              <ul className="space-y-2">
                {equipment.attentions.map((attention) => (
                  <li key={attention.id} className="rounded-lg border border-[var(--line)] bg-white p-3 text-sm">
                    <p className="font-medium">
                      {ATTENTION_LABEL[attention.attentionType as AttentionType] ?? attention.attentionType} · {attention.priorityName}
                      {attention.technicalCases.map((item) => (
                        can(session.role, "operation.queue", session.activeCompanyCode)
                          ? <Link key={item.id} href={`/operacion/${item.id}`} className="ml-2 text-[var(--accent)]">{item.folio}</Link>
                          : <span key={item.id} className="ml-2 text-[var(--muted)]">{item.folio}</span>
                      ))}
                    </p>
                    <p className="mt-1">{attention.reportedFault}</p>
                    <p className="mt-1 text-[var(--muted)]">
                      {attention.status === "ABIERTA" ? "SLA aún no inicia. Empieza cuando se confirma la entrada física." : `SLA iniciado ${attention.slaStartedAt ? formatWhen(attention.slaStartedAt) : ""}.`}
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
                        {movement.folio ? <span className="font-medium">{movement.folio}</span> : null}
                        {movement.folio ? " · " : ""}
                        {movement.reason}
                        {movement.receiverName ? ` · recibe ${movement.receiverName}` : ""}
                        {movement.enablingDocument ? ` · ${movement.enablingDocument}` : ""}
                        {movement.cancelReason ? ` · ${movement.cancelReason}` : ""}
                        {!movement.cancelledAt && movement.folio && isReceipt(movement.kind as MovementKind) ? (
                          <span className="ml-2">
                            <Link href={`/documentos/entrada/${movement.id}`} className="text-[var(--accent)]">Documento de recepción</Link>
                          </span>
                        ) : null}
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

        <section>
          <h2 className="mb-2 font-medium">Historial</h2>
          <HistoryTimeline items={history.map((row) => ({ id: row.id, createdAt: row.createdAt, summary: row.summary, authorName: row.author?.name }))} />
        </section>
      </div>
    </>
  );
}
