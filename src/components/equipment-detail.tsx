import { ClientNameLink } from "@/components/client-entity-links";
import { notFound } from "next/navigation";
import { CancelMovementForm, MovementForm } from "@/components/custody-forms";
import { EquipmentAttentionLauncher } from "@/components/equipment-attention-launcher";
import { EquipmentCustodyActions } from "@/components/equipment-custody-actions";
import { PassToResguardoForm } from "@/components/pass-to-resguardo-form";
import { WarehouseExitForm } from "@/components/warehouse-exit-form";
import { WarehouseExitFormAlmacen } from "@/components/warehouse-exit-form-almacen";
import { loadWarehouseExitContext } from "@/lib/warehouse-exit";
import { EquipmentLabel } from "@/components/equipment-label";
import { HistoryTimeline } from "@/components/history-timeline";
import { Badge, Card, DetailAnchorButton, EntityDetailHeader, EntityMetaItem, MobileCard, Table, Td, TextLink, Th } from "@/components/ui";
import { buildAlmacenEntradaPreset, pickCustodyFlowAttention } from "@/lib/almacen-entrada";
import { allowedMovements, CUSTODY_LABEL, isInitialWarehouseReceipt, isReceipt, MOVEMENT_LABEL, receiptReasonFromAttention, type Custody, type MovementKind } from "@/lib/custody";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { openPendingCases } from "@/lib/technical";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export async function EquipmentDetail({
  id,
  expectedKind,
  showLabel = false,
  fromCustodiaVista,
}: {
  id: string;
  expectedKind: "EQUI" | "MOT";
  showLabel?: boolean;
  /** Vista de almacén desde la que se abrió la ficha (p. ej. entradas). */
  fromCustodiaVista?: string;
}) {
  const session = await requireCompany();
  const almacenUx = session.role === "ALMACEN";
  const custodyDetail =
    can(session.role, "custody.confirm", session.activeCompanyCode)
    && ((expectedKind === "EQUI" && session.activeCompanyCode === "SYSTRON")
      || (expectedKind === "MOT" && session.activeCompanyCode === "SERVOMOTORES"));
  const almacenCustody = almacenUx && custodyDetail;
  const allowed = expectedKind === "EQUI"
    ? can(session.role, "equi.view", session.activeCompanyCode) || custodyDetail
    : can(session.role, "mot.view", session.activeCompanyCode) || custodyDetail;
  if (!allowed) notFound();
  const mayEquiList =
    can(session.role, "equi.view", session.activeCompanyCode)
    && (session.role === "VENTAS" || can(session.role, "equipment.catalog", session.activeCompanyCode));
  const mayMotList = can(session.role, "equipment.catalog", session.activeCompanyCode) && can(session.role, "mot.view", session.activeCompanyCode);
  let listHref = expectedKind === "EQUI" ? (mayEquiList ? "/equipos" : "/custodia") : (mayMotList ? "/motores" : "/custodia");
  if (almacenUx && listHref === "/custodia" && fromCustodiaVista) {
    listHref = `/custodia?vista=${fromCustodiaVista}`;
  }
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
  const custodyFlowAttention = pickCustodyFlowAttention(equipment.attentions);
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
  const inEntradasBandeja =
    (expectedKind === "EQUI" && equipment.custody === "SIN_CUSTODIA")
    || (expectedKind === "MOT" && equipment.custody === "PENDIENTE_INGRESO");
  /** Rol Almacén: equipos de la pestaña Entradas (sin entrada física aún). */
  const showAlmacenPasarResguardo = almacenCustody && canMove && inEntradasBandeja;
  const pendingQuote = showAlmacenPasarResguardo
    ? await prisma.quote.findFirst({
        where: {
          equipmentId: equipment.id,
          companyId: session.activeCompanyId,
          status: "AUTORIZADA_PENDIENTE_EQUIPO",
          quoteType: { in: ["DIAGNOSTICO", "REPARACION"] },
        },
        include: { lines: true },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const almacenEntradaPreset = showAlmacenPasarResguardo
    ? buildAlmacenEntradaPreset({
        kind: expectedKind,
        custody: equipment.custody,
        clientName: intercompany ? "SYSTRON · intercompañía" : equipment.client.name,
        attentions: equipment.attentions,
        quoteType: pendingQuote?.quoteType ?? null,
        quoteConcept: pendingQuote?.lines.find((line) => line.authorized)?.concept ?? pendingQuote?.lines[0]?.concept ?? null,
      })
    : undefined;
  const showPassToResguardo = showAlmacenPasarResguardo;
  const useWarehouseExit =
    custodyDetail
    && canMove
    && hasReceipt
    && !awaitingAttentionForReceipt
    && !showPassToResguardo
    && equipment.custody === "EN_RESGUARDO";
  const warehouseExit = useWarehouseExit
    ? await loadWarehouseExitContext({
      equipmentId: equipment.id,
      equipmentKind: expectedKind,
      custody: equipment.custody as Custody,
      companyId: session.activeCompanyId,
      forAlmacenRole: almacenCustody,
      openAttentionType: custodyFlowAttention?.attentionType ?? null,
      openAttentionId: custodyFlowAttention?.id ?? null,
    })
    : null;
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
  } else if (canMove && movementOptions.length > 0 && !awaitingAttentionForReceipt && !custodyDetail) {
    primaryAction = <DetailAnchorButton href="#custodia-equipo">Registrar movimiento</DetailAnchorButton>;
  }

  let custodyPrimaryAction: React.ReactNode = null;
  if (custodyDetail && !almacenCustody && !awaitingAttentionForReceipt && canMove && movementOptions.length > 0) {
    const label = simplifiedReceipt
      ? "Confirmar entrada física"
      : useWarehouseExit
        ? "Registrar salida"
        : "Registrar movimiento";
    custodyPrimaryAction = <DetailAnchorButton href="#custodia-equipo">{label}</DetailAnchorButton>;
  }

  const showCustodyMovementBar =
    showAlmacenPasarResguardo
    || (custodyDetail && !awaitingAttentionForReceipt && canMove && movementOptions.length > 0);
  const custodyBarSticky =
    showCustodyMovementBar && (showAlmacenPasarResguardo || almacenCustody || movementOptions.length > 0);

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
        primaryAction={almacenCustody ? null : custodyDetail ? custodyPrimaryAction : primaryAction}
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

        <div id="custodia-equipo" className="scroll-mt-24">
          {showAlmacenPasarResguardo ? (
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-[#0b1f3a]">Entrada pendiente</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">El servicio ya fue definido por Ventas. Al pasar a resguardo se inicia el SLA y el folio DX u OS.</p>
            </div>
          ) : custodyDetail ? (
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-[#0b1f3a]">{almacenCustody ? "Custodia" : "Recepción física"}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {almacenCustody
                  ? "Movimientos físicos posteriores a la recepción."
                  : "El servicio ya fue definido por Ventas. Confirma la entrada para iniciar el SLA y generar el folio DX u OS."}
              </p>
            </div>
          ) : null}
          {showCustodyMovementBar ? (
            <div className={custodyBarSticky ? "sticky top-3 z-20 rounded-xl border border-[var(--line)] bg-white/95 p-2 shadow-[0_8px_24px_rgba(20,45,75,0.12)] backdrop-blur" : ""}>
              <EquipmentCustodyActions
                showMovement={showAlmacenPasarResguardo || (canMove && movementOptions.length > 0)}
                showAttention={false}
                movementButtonLabel={
                  showAlmacenPasarResguardo ? "Pasar a resguardo" : useWarehouseExit ? "Registrar salida" : "Registrar movimiento"
                }
                movementTitle={
                  showAlmacenPasarResguardo ? "Pasar a resguardo" : useWarehouseExit ? "Registrar salida" : "Registrar movimiento"
                }
                movement={
                  showAlmacenPasarResguardo && almacenEntradaPreset ? (
                    <PassToResguardoForm
                      equipmentId={equipment.id}
                      equipmentFolio={equipment.folio}
                      kind={expectedKind}
                      version={equipment.version}
                      movement={almacenEntradaPreset.movement}
                      reason={almacenEntradaPreset.reason}
                      serviceLabel={almacenEntradaPreset.serviceLabel}
                      reportedFault={almacenEntradaPreset.reportedFault}
                      clientName={almacenEntradaPreset.clientName}
                    />
                  ) : useWarehouseExit && warehouseExit ? (
                    almacenCustody ? (
                      <WarehouseExitFormAlmacen
                        equipmentId={equipment.id}
                        equipmentFolio={equipment.folio}
                        kind={expectedKind}
                        version={equipment.version}
                        exitMovement={warehouseExit.exitMovement}
                        definitiveReason={warehouseExit.definitiveReason}
                        sellerName={warehouseExit.sellerName}
                        technicalCaseId={warehouseExit.technicalCaseId}
                        enablingDocumentLabel={warehouseExit.enablingDocumentLabel}
                        exitKind={warehouseExit.exitKind}
                        blockedMessage={warehouseExit.blockedMessage}
                        testReason={warehouseExit.testReason}
                      />
                    ) : (
                      <WarehouseExitForm
                        equipmentId={equipment.id}
                        equipmentFolio={equipment.folio}
                        kind={expectedKind}
                        version={equipment.version}
                        exitMovement={warehouseExit.exitMovement}
                        definitiveReason={warehouseExit.definitiveReason}
                        sellerName={warehouseExit.sellerName}
                        canDefinitiveExit={warehouseExit.canDefinitiveExit}
                        definitiveBlockedMessage={warehouseExit.definitiveBlockedMessage}
                        technicalCaseId={warehouseExit.technicalCaseId}
                        enablingDocumentLabel={warehouseExit.enablingDocumentLabel}
                        canTestExit={warehouseExit.canTestExit}
                        testReason={warehouseExit.testReason}
                      />
                    )
                  ) : (
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
          ) : null}
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
