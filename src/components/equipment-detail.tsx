import { ClientNameLink } from "@/components/client-entity-links";
import { notFound } from "next/navigation";
import { CancelMovementForm, MovementForm } from "@/components/custody-forms";
import { EquipmentAttentionLauncher } from "@/components/equipment-attention-launcher";
import { EquipmentCustodyActions } from "@/components/equipment-custody-actions";
import { EquipmentLabel } from "@/components/equipment-label";
import { HistoryTimeline } from "@/components/history-timeline";
import { Badge, Card, DetailAnchorButton, DetailFormSubmitButton, EntityDetailHeader, EntityMetaItem, MobileCard, Table, Td, TextLink, Th } from "@/components/ui";
import { allowedMovements, CUSTODY_LABEL, isInitialWarehouseReceipt, isReceipt, MOVEMENT_LABEL, receiptReasonFromAttention, type Custody, type MovementKind } from "@/lib/custody";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { openPendingCases } from "@/lib/technical";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export async function EquipmentDetail({ id, expectedKind, showLabel = false }: { id: string; expectedKind: "EQUI" | "MOT"; showLabel?: boolean }) {
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
  const hasReceipt = equipment.movements.some((row) => !row.cancelledAt && isReceipt(row.kind as MovementKind));
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
  const activeCase = openAttention?.technicalCases[0] ?? null;
  const activeServiceHref = activeCase
    ? `/operacion/${activeCase.id}`
    : openAttention
      ? `/atenciones/${openAttention.id}`
      : null;
  const activeServiceFolio = activeCase?.folio
    ?? (openAttention ? (openAttention.attentionType === "REPARACION" ? "OS" : "DX") : null);
  const activeServiceLabel = openAttention
    ? ATTENTION_LABEL[openAttention.attentionType as AttentionType] ?? openAttention.attentionType
    : null;
  const receiptPreset =
    simplifiedReceipt && receiptMovement && openAttention && receiptReason
      ? {
          movement: receiptMovement,
          reason: receiptReason,
          serviceLabel: ATTENTION_LABEL[openAttention.attentionType as AttentionType] ?? openAttention.attentionType,
          reportedFault: openAttention.reportedFault,
          clientName: intercompany ? "SYSTRON · intercompañía" : equipment.client.name,
        }
      : undefined;

  const backLabel = listHref === "/custodia" ? "Almacén" : expectedKind === "EQUI" ? "Equipos" : "Motores";
  const warehouseReceiptFormId = "warehouse-receipt-form";
  const oneStepWarehouseReceipt =
    custodyDetail && canMove && simplifiedReceipt && !awaitingAttentionForReceipt;
  let primaryAction: React.ReactNode = null;
  const clientDisplayName = intercompany ? "SYSTRON · intercompañía" : equipment.client.name;
  if (awaitingAttentionForReceipt && canAttend) {
    primaryAction = (
      <EquipmentAttentionLauncher
        equipmentId={equipment.id}
        equipmentFolio={equipment.folio}
        clientName={clientDisplayName}
        kind={expectedKind}
        version={equipment.version}
        priorities={priorities.map((row) => ({ id: row.id, attentionType: row.attentionType, name: row.name }))}
      />
    );
  } else if (oneStepWarehouseReceipt) {
    primaryAction = <DetailFormSubmitButton form={warehouseReceiptFormId}>Confirmar entrada física</DetailFormSubmitButton>;
  } else if (canMove && simplifiedReceipt && !awaitingAttentionForReceipt) {
    primaryAction = <DetailAnchorButton href="#custodia-equipo">Confirmar entrada física</DetailAnchorButton>;
  } else if (canMove && movementOptions.length > 0 && !awaitingAttentionForReceipt) {
    primaryAction = <DetailAnchorButton href="#custodia-equipo">Registrar movimiento</DetailAnchorButton>;
  }
  let custodyPrimaryAction: React.ReactNode = null;
  if (custodyDetail && !awaitingAttentionForReceipt) {
    if (oneStepWarehouseReceipt) {
      custodyPrimaryAction = primaryAction;
    } else if (canMove && movementOptions.length > 0) {
      custodyPrimaryAction = (
        <DetailAnchorButton href="#custodia-equipo">
          {simplifiedReceipt ? "Confirmar entrada física" : "Registrar movimiento"}
        </DetailAnchorButton>
      );
    }
  }

  return (
    <>
      <EntityDetailHeader
        back={{ href: listHref, label: backLabel }}
        title={equipment.folio}
        subtitle={expectedKind === "EQUI" ? "Identidad física EQUI" : "Identidad física MOT"}
        status={<Badge>{CUSTODY_LABEL[equipment.custody as Custody] ?? equipment.custody}</Badge>}
        meta={
          <>
            <EntityMetaItem label="Origen">{equipment.originCompany.name}</EntityMetaItem>
            <EntityMetaItem label="Cliente">
              {intercompany ? "SYSTRON · intercompañía" : (
                <ClientNameLink clientId={equipment.client.id} name={equipment.client.name} isSystem={equipment.client.isSystem} canEdit={can(session.role, "client.edit", session.activeCompanyCode)} />
              )}
            </EntityMetaItem>
            <EntityMetaItem label="Identificación">{[equipment.typeName, equipment.brandName, equipment.model].filter(Boolean).join(" · ") || "—"}</EntityMetaItem>
            {equipment.serial ? <EntityMetaItem label="Serie">{equipment.serial}</EntityMetaItem> : null}
            {custodyDetail && activeServiceFolio ? (
              <EntityMetaItem label="Servicio asociado">
                {activeServiceHref ? <TextLink href={activeServiceHref}>{activeServiceFolio}</TextLink> : activeServiceFolio}
                <span className="block text-xs text-[var(--muted)]">{activeServiceLabel} · {openAttention?.priorityName}</span>
              </EntityMetaItem>
            ) : null}
            {custodyDetail && sellerUser ? <EntityMetaItem label="Vendedor">{sellerUser.name}</EntityMetaItem> : null}
            {intercompany && sellerUser ? <EntityMetaItem label="Contacto SYSTRON">{sellerUser.name}</EntityMetaItem> : null}
          </>
        }
        primaryAction={custodyDetail ? custodyPrimaryAction : primaryAction}
      />
      {custodyDetail && hasReceipt ? (
        <div className="mb-6">
          <EquipmentLabel
            equipmentHref={expectedKind === "MOT" ? `/motores/${equipment.id}` : `/equipos/${equipment.id}`}
            equipmentFolio={equipment.folio}
            kind={expectedKind}
            typeName={equipment.typeName}
            brandName={equipment.brandName}
            model={equipment.model}
            serial={equipment.serial}
            autoOpen={showLabel}
          />
        </div>
      ) : null}
      <div className="space-y-6">
        {equipment.description ? <p className="text-sm text-[var(--muted)]">{equipment.description}</p> : null}
        {expectedKind === "MOT" && session.activeCompanyCode === "SYSTRON" ? (
          <p className="text-sm text-[var(--muted)]">Este MOT no entra al almacén SYSTRON. El estado físico lo confirma Servomotores.</p>
        ) : null}

        {custodyDetail && openAttention ? (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] bg-[#f7fafc] p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Servicio asociado</p>
                <h2 className="mt-1 text-lg font-semibold text-[#0b1f3a]">{activeServiceLabel}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{activeServiceFolio} · prioridad {openAttention.priorityName}</p>
              </div>
              {activeServiceHref ? <TextLink href={activeServiceHref}>Abrir atención →</TextLink> : null}
            </div>
            <div className="grid gap-4 p-5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Falla reportada</p>
                <p className="mt-1 leading-6">{openAttention.reportedFault}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">SLA</p>
                <p className="mt-1 leading-6">{openAttention.slaStartedAt ? `Iniciado ${formatWhen(openAttention.slaStartedAt)}` : "Inicia al confirmar la entrada física"}</p>
              </div>
              {openAttention.antecedent ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Antecedente</p>
                  <p className="mt-1 leading-6">{openAttention.antecedent}</p>
                </div>
              ) : null}
              {openAttention.initialLog ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Bitácora inicial</p>
                  <p className="mt-1 whitespace-pre-wrap leading-6">{openAttention.initialLog}</p>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {oneStepWarehouseReceipt && receiptPreset ? (
          <div className="hidden">
            <MovementForm
              variant="plain"
              equipmentId={equipment.id}
              equipmentFolio={equipment.folio}
              kind={expectedKind}
              custody={equipment.custody as Custody}
              version={equipment.version}
              suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
              allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
              formId={warehouseReceiptFormId}
              hideSubmit
              receiptPreset={receiptPreset}
            />
          </div>
        ) : null}
        <div id="custodia-equipo" className="scroll-mt-24">
          {custodyDetail ? (
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-[#0b1f3a]">Recepción física</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">El servicio ya fue definido por Ventas. Confirma la entrada para iniciar el SLA y generar el folio DX u OS.</p>
            </div>
          ) : null}
          <div className={custodyDetail && !oneStepWarehouseReceipt ? "sticky top-3 z-20 rounded-xl border border-[var(--line)] bg-white/95 p-2 shadow-[0_8px_24px_rgba(20,45,75,0.12)] backdrop-blur" : ""}>
            <EquipmentCustodyActions
              showMovement={canMove && movementOptions.length > 0 && !awaitingAttentionForReceipt && !oneStepWarehouseReceipt}
              showAttention={false}
              movementButtonLabel={simplifiedReceipt ? "Confirmar entrada física" : "Registrar movimiento"}
              movementTitle={simplifiedReceipt ? "Confirmar entrada física" : "Registrar movimiento"}
              movement={
                oneStepWarehouseReceipt ? null : (
                  <MovementForm
                    variant="plain"
                    equipmentId={equipment.id}
                    equipmentFolio={equipment.folio}
                    kind={expectedKind}
                    custody={equipment.custody as Custody}
                    version={equipment.version}
                    suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }))}
                    allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
                    receiptPreset={receiptPreset}
                  />
                )
              }
              attention={null}
            />
          </div>
        </div>

        {!custodyDetail || equipment.attentions.length > 1 ? <section>
            <h2 className="mb-2 font-medium">{custodyDetail ? "Historial de servicios" : "Atenciones"}</h2>
            {equipment.attentions.length === 0 ? <p className="text-sm text-[var(--muted)]">Todavía no hay un episodio de servicio.</p> : (
              <ul className="space-y-2">
                {equipment.attentions.map((attention) => {
                  const caseRow = attention.technicalCases[0];
                  const attentionHref = caseRow ? `/operacion/${caseRow.id}` : `/atenciones/${attention.id}`;
                  return (
                  <li key={attention.id}>
                    <MobileCard href={attentionHref} title={`${ATTENTION_LABEL[attention.attentionType as AttentionType] ?? attention.attentionType} · ${attention.priorityName}`}>
                      {attention.technicalCases.length > 0 ? (
                        <p>
                          {attention.technicalCases.map((item) => (
                            <span key={item.id} className="mr-2 text-[var(--muted)]">{item.folio}</span>
                          ))}
                        </p>
                      ) : null}
                      <p>{attention.reportedFault}</p>
                      <p>
                        {attention.status === "ABIERTA" ? "SLA aún no inicia. Empieza cuando se confirma la entrada física." : `SLA iniciado ${attention.slaStartedAt ? formatWhen(attention.slaStartedAt) : ""}.`}
                        {attention.antecedent ? ` Antecedente: ${attention.antecedent}.` : ""}
                      </p>
                      {!caseRow ? <p className="font-medium text-[var(--accent)]">Ver detalle de la atención →</p> : null}
                      {attention.deliveryInstructions ? <p>Entrega: {attention.deliveryInstructions}</p> : null}
                      {attention.initialLog ? <p>Bitácora inicial: {attention.initialLog}</p> : null}
                      {intercompany ? <p>Cliente administrativo: {attention.adminClient.name}</p> : null}
                    </MobileCard>
                  </li>
                  );
                })}
              </ul>
            )}
          </section> : null}
          <section>
            <h2 className="mb-2 font-medium">{custodyDetail ? "Movimientos secundarios" : "Movimientos físicos"}</h2>
            {custodyDetail ? <p className="mb-2 text-sm text-[var(--muted)]">Aquí aparecerán pruebas, salidas, retornos y demás movimientos posteriores a la recepción.</p> : null}
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
                            <TextLink href={`/documentos/entrada/${movement.id}`}>Documento de recepción</TextLink>
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
