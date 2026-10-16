import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prepareFromCaseAction } from "@/app/(erp)/cotizaciones/actions";
import {
  assignCaseAction,
  createPresolicitudAction,
  deletePresolicitudAction,
  finishDiagnosisAction,
  finishRepairAction,
  issuePartAction,
  logAction,
  markPaidAction,
  overrideWarrantyAction,
  receivePartAction,
  reopenAction,
  requestPartAction,
  startCaseAction,
  updatePresolicitudAction,
  validateAction,
} from "../actions";
import { ClientNameLink } from "@/components/client-entity-links";
import { DiagnosisValidationActions } from "@/components/diagnosis-validation-actions";
import { RequestExitWithoutDocumentButton } from "@/components/exit-without-document-actions";
import { RepairClosureActions } from "@/components/repair-closure-actions";
import { SupervisorReassignControl } from "@/components/supervisor-reassign-control";
import { HistoryTimeline, type HistoryTimelineItem } from "@/components/history-timeline";
import {
  Badge,
  Button,
  Card,
  controlClass,
  DetailAnchorButton,
  DetailGrid,
  EntityDetailHeader,
  EntityMetaItem,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  TextLink,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { buildAttentionHistoryTimeline, seesFullAttentionHistory } from "@/lib/attention-history";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { diagnosisPresolicitudEditable, fieldPresolicitudOnly, PRESOLICITUD_LABEL } from "@/lib/part-presolicitud";
import { CASE_STATUS_LABEL, lastTechnicianWhoClosedEquipmentCase } from "@/lib/technical";
import { homePath } from "@/lib/home";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { serviciosBandejaHref } from "@/lib/servicios-catalog";
import { HISTORIAL_CASE } from "@/lib/servicios-supervisor";
import { requireCompany } from "@/lib/session";
import { definitiveExitAuthorized, findEnablingBillingDocument } from "@/lib/warehouse-exit";

export default async function OperacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (session.role === "ALMACEN") redirect(homePath(session.role, session.activeCompanyCode));
  const { id } = await params;
  const loadedRow = await prisma.technicalCase.findUnique({
    where: { id },
    include: {
      attention: true,
      equipment: { include: { originCompany: true, client: true } },
      serviceCompany: true,
      assignee: true,
      logs: { orderBy: { createdAt: "asc" } },
      requests: { orderBy: { createdAt: "asc" } },
      presolicitudes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!loadedRow) notFound();
  const row = loadedRow!;
  const reflected = session.activeCompanyCode === "SYSTRON" && row.serviceCompany.code === "SERVOMOTORES" && row.equipment.originCompanyId === session.activeCompanyId;
  const owns = row.serviceCompanyId === session.activeCompanyId;
  if (!owns && !reflected) notFound();
  if (!can(session.role, row.equipment.kind === "EQUI" ? "equi.view" : "mot.view", session.activeCompanyCode) && !reflected) notFound();
  await redirectIfSalesNotAssigned(session, row.equipment.client.ownerUserId, "/operacion");
  const technicianOwned = row.assigneeUserId === session.userId || row.finishedByUserId === session.userId;
  if (session.role === "TECNICO" && !technicianOwned) notFound();
  const readOnly = !owns;
  const authors = await prisma.user.findMany({
    where: { id: { in: row.logs.map((item) => item.authorUserId) } },
    select: { id: true, name: true },
  });
  const names = new Map(authors.map((user) => [user.id, user.name]));
  const candidates = owns
    ? await prisma.user.findMany({
        where: {
          active: true,
          companyId: row.serviceCompanyId,
          role: row.serviceCompany.code === "SERVOMOTORES" ? "GERENTE_OPERATIVO_SERVOMOTORES" : { in: ["TECNICO", "SUPERVISOR_TECNICO"] },
        },
        orderBy: { name: "asc" },
      })
    : [];
  const suggestedAssigneeRaw = owns
    ? await lastTechnicianWhoClosedEquipmentCase(row.equipmentId, row.serviceCompanyId, row.id)
    : null;
  const suggestedAssigneeId =
    suggestedAssigneeRaw && candidates.some((user) => user.id === suggestedAssigneeRaw)
      ? suggestedAssigneeRaw
      : null;
  const defaultAssigneeId = row.assigneeUserId ?? suggestedAssigneeId ?? "";
  const enablingBilling = await findEnablingBillingDocument(row.id);
  const exitAuthorized = definitiveExitAuthorized(row);
  const exitPending = Boolean(row.exitWithoutDocumentRequestedAt && !row.exitWithoutDocumentAuthorizedAt);
  const showExitWithoutDocument =
    row.kind === "OS"
    && row.status === "TERMINADA"
    && row.equipment.custody === "EN_RESGUARDO"
    && (session.role === "VENTAS" && row.attention.sellerUserId === session.userId || exitPending || exitAuthorized);

  const [caseHistory, seller, relatedQuotes, relatedBilling, relatedSales] = await Promise.all([
    historyFor("OPERACION", row.id),
    row.attention.sellerUserId
      ? prisma.user.findUnique({ where: { id: row.attention.sellerUserId }, select: { id: true, name: true } })
      : null,
    prisma.quote.findMany({
      where: {
        OR: [
          { technicalCaseId: row.id },
          ...(row.attention.originQuoteId ? [{ id: row.attention.originQuoteId }] : []),
        ],
      },
      select: { id: true, folio: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.billingDocument.findMany({
      where: { technicalCaseId: row.id },
      select: { id: true, folio: true, kind: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sale.findMany({
      where: { quote: { technicalCaseId: row.id } },
      select: { id: true, folio: true, quoteId: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const caseHistoryItems: HistoryTimelineItem[] = caseHistory.map((item) => ({
    id: item.id,
    createdAt: item.createdAt,
    summary: item.summary,
    authorName: item.author?.name,
  }));
  let historyTimelineItems: HistoryTimelineItem[] = caseHistoryItems;
  if (seesFullAttentionHistory(session.role)) {
    const attentionContext = await prisma.attention.findUnique({
      where: { id: row.attentionId },
      include: {
        movements: { where: { cancelledAt: null }, orderBy: { occurredAt: "asc" } },
        technicalCases: { orderBy: { createdAt: "asc" }, select: { id: true, folio: true, kind: true, status: true, createdAt: true } },
      },
    });
    if (attentionContext) {
      const caseIds = attentionContext.technicalCases.map((item) => item.id);
      const quoteIds = relatedQuotes.map((item) => item.id);
      const [attentionHistory, operationHistory, quoteHistoryRows] = await Promise.all([
        historyFor("ATENCION", attentionContext.id),
        prisma.functionalHistory.findMany({
          where: { entityType: "OPERACION", entityId: { in: caseIds } },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        }),
        quoteIds.length > 0
          ? prisma.functionalHistory.findMany({
              where: { entityType: "COTIZACION", entityId: { in: quoteIds } },
              orderBy: { createdAt: "asc" },
              include: { author: { select: { name: true } } },
            })
          : Promise.resolve([]),
      ]);
      const quoteFolioById = new Map(relatedQuotes.map((item) => [item.id, item.folio]));
      const quoteHistories = quoteIds.map((quoteId) => ({
        quoteFolio: quoteFolioById.get(quoteId) ?? "Cotización",
        items: quoteHistoryRows.filter((item) => item.entityId === quoteId),
      }));
      const authorIds = [
        attentionContext.createdByUserId,
        ...attentionContext.movements.map((item) => item.authorUserId),
      ].filter((id): id is string => Boolean(id));
      const authorRows = authorIds.length > 0
        ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } })
        : [];
      const authorNames = new Map(authorRows.map((item) => [item.id, item.name]));
      historyTimelineItems = buildAttentionHistoryTimeline({
        attention: attentionContext,
        movements: attentionContext.movements,
        technicalCases: attentionContext.technicalCases,
        attentionHistory,
        operationHistory,
        quoteHistories,
        authorNames,
      });
    }
  }
  const repairAfterDiagnosis = row.kind === "OS" && row.attention.attentionType === "DIAGNOSTICO";
  const equipmentHref = row.equipment.kind === "MOT" ? `/motores/${row.equipmentId}` : `/equipos/${row.equipmentId}`;
  const historial = (HISTORIAL_CASE as readonly string[]).includes(row.status);
  const closed = historial;
  const warranty = row.attention.attentionType === "DIAGNOSTICO_GARANTIA" && row.kind === "DIAGNOSTICO";
  const canManage = !readOnly && ["ADMINISTRADOR", "CEO", "SUPERVISOR_TECNICO", "GERENTE_OPERATIVO_SYSTRON", "GERENTE_OPERATIVO_SERVOMOTORES"].includes(session.role);
  const canWork = !readOnly && (session.role === "ADMINISTRADOR" || session.role === "CEO" || session.role === "SUPERVISOR_TECNICO" || (session.role === "GERENTE_OPERATIVO_SERVOMOTORES" && session.activeCompanyCode === "SERVOMOTORES") || (session.role === "TECNICO" && row.assigneeUserId === session.userId));
  const awaitingStart = row.status === "EN_ESPERA" || row.status === "DEVUELTO";
  const canStartPending =
    !readOnly
    && awaitingStart
    && Boolean(row.assigneeUserId)
    && (session.role === "TECNICO"
      ? row.assigneeUserId === session.userId
      : session.role === "SUPERVISOR_TECNICO"
        ? row.assigneeUserId === session.userId
        : canWork);
  const showInitialAssignment = canManage && !closed && awaitingStart && !row.assigneeUserId;
  const showSupervisorReassign =
    !readOnly
    && session.role === "SUPERVISOR_TECNICO"
    && !closed
    && Boolean(row.assigneeUserId);
  const presolicitudOnly = fieldPresolicitudOnly(session.role);
  const canEditPresolicitud =
    !readOnly &&
    row.kind === "DIAGNOSTICO" &&
    diagnosisPresolicitudEditable(row.status) &&
    (session.role === "SUPERVISOR_TECNICO" ||
      (session.role === "TECNICO" && row.assigneeUserId === session.userId));
  const canOperatePartRequests = canWork && !closed && !readOnly && !presolicitudOnly;
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const slaOverdue = row.slaDueAt != null && row.slaDueAt.getTime() < Date.now() && !closed;
  const back = can(session.role, "attention.catalog", session.activeCompanyCode)
    ? { href: serviciosBandejaHref({ vista: historial ? "historial" : "activos" }), label: "Servicios" }
    : { href: "/operacion", label: "En proceso" };
  const equipmentIdentity = [row.equipment.typeName, row.equipment.brandName, row.equipment.model].filter(Boolean).join(" · ");
  const relatedLinks = [
    { label: "Cliente", href: `/clientes/${row.equipment.client.id}` },
    { label: "Equipo", href: equipmentHref },
    ...(relatedQuotes.length > 0
      ? [{ label: `Cotizaciones${relatedQuotes.length > 1 ? ` (${relatedQuotes.length})` : ""}`, href: relatedQuotes.length === 1 ? `/cotizaciones/${relatedQuotes[0].id}` : "/cotizaciones" }]
      : []),
    ...(relatedSales.length > 0
      ? [{ label: `Ventas${relatedSales.length > 1 ? ` (${relatedSales.length})` : ""}`, href: relatedSales.length === 1 ? `/ventas/${relatedSales[0].id}` : "/ventas" }]
      : []),
    ...(relatedBilling.length > 0
      ? [{ label: `Facturación${relatedBilling.length > 1 ? ` (${relatedBilling.length})` : ""}`, href: relatedBilling.length === 1 ? `/facturacion/${relatedBilling[0].id}` : "/facturacion" }]
      : []),
  ];

  const headerAssignmentForm = showInitialAssignment ? (
    <form action={assignCaseAction} className="inline-flex max-w-full items-center gap-2">
      <input type="hidden" name="caseId" value={row.id} />
      <input type="hidden" name="version" value={row.version} />
      <select
        name="assigneeUserId"
        required
        aria-label="Técnico responsable"
        className={`${controlClass} min-h-9 min-w-[9.5rem] max-w-[11rem] py-1.5 text-sm`}
        defaultValue={defaultAssigneeId}
      >
        {!defaultAssigneeId ? <option value="">Técnico</option> : null}
        {candidates.map((user) => (
          <option key={user.id} value={user.id}>{user.name}</option>
        ))}
      </select>
      <Button type="submit" className="min-h-9 shrink-0 px-3 py-1.5 text-sm">Asignar</Button>
    </form>
  ) : null;

  let primaryAction: React.ReactNode = null;
  if (!readOnly) {
    if (canStartPending) {
      primaryAction = (
        <form action={startCaseAction} className="inline">
          <input type="hidden" name="caseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <Button type="submit">Iniciar trabajo</Button>
        </form>
      );
    } else if (canWork && row.kind === "DIAGNOSTICO" && ["EN_DIAGNOSTICO", "DEVUELTO"].includes(row.status)) {
      primaryAction = (
        <form action={finishDiagnosisAction} className="inline">
          <input type="hidden" name="caseId" value={row.id} />
          <input type="hidden" name="version" value={row.version} />
          <Button type="submit">Concluir diagnóstico</Button>
        </form>
      );
    } else if (
      canManage &&
      row.kind === "DIAGNOSTICO" &&
      (row.status === "PENDIENTE_VALIDACION" || (row.serviceCompany.code === "SERVOMOTORES" && row.status === "VALIDADO" && warranty && !row.warrantyDecision))
    ) {
      primaryAction = (
        <DiagnosisValidationActions
          caseId={row.id}
          version={row.version}
          warranty={warranty}
          validateAction={validateAction}
        />
      );
    } else if (canWork && row.kind === "OS" && ["EN_REPARACION", "EN_ESPERA_REFACCIONES"].includes(row.status)) {
      primaryAction = (
        <RepairClosureActions
          caseId={row.id}
          version={row.version}
          finishRepairAction={finishRepairAction}
        />
      );
    } else if (row.quotePending && can(session.role, "quote.price", session.activeCompanyCode)) {
      primaryAction = (
        <form action={prepareFromCaseAction} className="inline">
          <input type="hidden" name="caseId" value={row.id} />
          <Button type="submit">Preparar cotización</Button>
        </form>
      );
    } else if (row.warrantyDecision === "NO_PROCEDENTE" && !row.commercialDecision && (session.role === "CEO" || session.role === "ADMINISTRADOR")) {
      primaryAction = <DetailAnchorButton href="#decision-comercial">Decidir comercialmente</DetailAnchorButton>;
    }
  }

  const partsSection = row.kind === "DIAGNOSTICO" ? (
    <Card className="p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Refacciones</h2>
          <p className="mt-1 text-[var(--muted)]">
            Presolicitud durante el diagnóstico. Si el cliente autoriza, pasan a la orden de servicio.
          </p>
        </div>
        {canEditPresolicitud ? <Badge tone="ok">Presolicitud disponible</Badge> : null}
      </div>
      {row.presolicitudes.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-[var(--line)] px-3 py-4 text-[var(--muted)]">Sin presolicitudes registradas.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {row.presolicitudes.map((item) => (
            <li key={item.id} className="rounded-lg border border-[var(--line)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{item.partNumber} · {item.description}</p>
                <Badge tone={item.status === "ACTIVA" ? "warn" : "neutral"}>{PRESOLICITUD_LABEL[item.status] ?? item.status}</Badge>
              </div>
              <p className="mt-1 text-[var(--muted)]">
                Cantidad {item.qtyRequested}
                {item.link ? (
                  <>
                    {" · "}
                    <a href={item.link} className="text-[var(--accent)]" target="_blank" rel="noreferrer">Referencia</a>
                  </>
                ) : null}
              </p>
              {canEditPresolicitud && item.status === "ACTIVA" ? (
                <details className="mt-3 rounded-lg bg-[#f7fafc] p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">Editar presolicitud</summary>
                  <div className="mt-3 space-y-2">
                    <form action={updatePresolicitudAction} className="grid gap-2">
                      <input type="hidden" name="caseId" value={row.id} />
                      <input type="hidden" name="presolicitudId" value={item.id} />
                      <Field label="Número de parte"><input name="partNumber" required defaultValue={item.partNumber} className={controlClass} /></Field>
                      <Field label="Descripción"><input name="description" required defaultValue={item.description} className={controlClass} /></Field>
                      <Field label="Liga opcional"><input name="link" defaultValue={item.link ?? ""} className={controlClass} /></Field>
                      <Field label="Cantidad"><input name="quantity" type="number" min={1} required defaultValue={item.qtyRequested} className={controlClass} /></Field>
                      <Button type="submit" tone="ghost">Guardar cambios</Button>
                    </form>
                    <form action={deletePresolicitudAction}>
                      <input type="hidden" name="caseId" value={row.id} />
                      <input type="hidden" name="presolicitudId" value={item.id} />
                      <Button type="submit" tone="ghost">Quitar presolicitud</Button>
                    </form>
                  </div>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEditPresolicitud ? (
        <details className="mt-3 rounded-lg border border-[var(--line)] bg-[#f7fafc] p-3" open={row.presolicitudes.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">Presolicitar refacción</summary>
          <form action={createPresolicitudAction} className="mt-3 grid gap-2">
            <input type="hidden" name="caseId" value={row.id} />
            <Field label="Número de parte"><input name="partNumber" required className={controlClass} /></Field>
            <Field label="Descripción"><input name="description" required className={controlClass} /></Field>
            <Field label="Liga opcional"><input name="link" className={controlClass} /></Field>
            <Field label="Cantidad"><input name="quantity" type="number" min={1} required className={controlClass} /></Field>
            <Button type="submit">Registrar presolicitud</Button>
          </form>
        </details>
      ) : null}
    </Card>
  ) : (
    <Card className="p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">Refacciones</h2>
          <p className="mt-1 text-[var(--muted)]">Solicitudes formales asociadas a esta orden de servicio.</p>
        </div>
        {canOperatePartRequests ? <Badge tone="ok">Captura disponible</Badge> : null}
      </div>
      {row.requests.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-[var(--line)] px-3 py-4 text-[var(--muted)]">Sin solicitudes registradas.</p> : (
        <ul className="mt-3 space-y-3">
          {row.requests.map((request) => (
            <li key={request.id} className="rounded-lg border border-[var(--line)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{request.partNumber} · {request.description}</p>
                <Badge tone={request.status === "SURTIDA" ? "ok" : "warn"}>{request.status}</Badge>
              </div>
              <p className="mt-1 text-[var(--muted)]">Solicitada {request.qtyRequested} · recibida {request.qtyReceived} · surtida {request.qtyIssued}</p>
              {canOperatePartRequests ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={receivePartAction} className="flex gap-1">
                    <input type="hidden" name="caseId" value={row.id} />
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="version" value={request.version} />
                    <input name="quantity" type="number" min={1} required aria-label="Cantidad recibida" placeholder="Cant." className="w-20 rounded-md border border-[var(--line)] px-2 py-1" />
                    <Button type="submit" tone="ghost">Recibir</Button>
                  </form>
                  <form action={issuePartAction} className="flex gap-1">
                    <input type="hidden" name="caseId" value={row.id} />
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="version" value={request.version} />
                    <input name="quantity" type="number" min={1} required aria-label="Cantidad surtida" placeholder="Cant." className="w-20 rounded-md border border-[var(--line)] px-2 py-1" />
                    <Button type="submit" tone="ghost">Surtir</Button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canOperatePartRequests ? (
        <details className="mt-3 rounded-lg border border-[var(--line)] bg-[#f7fafc] p-3" open={row.requests.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent)]">Solicitar refacción</summary>
          <form action={requestPartAction} className="mt-3 grid gap-2">
            <input type="hidden" name="caseId" value={row.id} />
            <Field label="Número de parte"><input name="partNumber" required className={controlClass} /></Field>
            <Field label="Descripción"><input name="description" required className={controlClass} /></Field>
            <Field label="Liga opcional"><input name="link" className={controlClass} /></Field>
            <Field label="Cantidad"><input name="quantity" type="number" min={1} required className={controlClass} /></Field>
            <Button type="submit">Registrar solicitud</Button>
          </form>
        </details>
      ) : presolicitudOnly && !closed ? (
        <p className="mt-3 rounded-lg bg-[#f7fafc] px-3 py-3 text-[var(--muted)]">En reparación las solicitudes formales las registra gerencia o almacén.</p>
      ) : null}
    </Card>
  );

  return (
    <>
      <EntityDetailHeader
        back={back}
        title={`Atención · ${row.folio}`}
        subtitle={`${row.kind === "OS" ? "Orden de servicio" : "Diagnóstico"} · ${row.serviceCompany.name}`}
        status={<Badge tone={row.quotePending || slaOverdue ? "warn" : "neutral"}>{CASE_STATUS_LABEL[row.status] ?? row.status}</Badge>}
        meta={
          <>
            <EntityMetaItem label="Identificación del equipo">
              <TextLink href={equipmentHref}>{equipmentIdentity || row.equipment.folio}</TextLink>
              <span className="block text-xs text-[var(--muted)]">
                {row.equipment.folio}{row.equipment.serial ? ` · Serie ${row.equipment.serial}` : ""}
              </span>
            </EntityMetaItem>
            <EntityMetaItem label="Cliente">
              <ClientNameLink
                clientId={row.equipment.client.id}
                name={row.equipment.client.name}
                isSystem={row.equipment.client.isSystem}
                canEdit={canEditClient}
              />
            </EntityMetaItem>
            <EntityMetaItem label="Vendedor">{seller?.name ?? "Sin vendedor asignado"}</EntityMetaItem>
            <EntityMetaItem label="Responsable">
              <span className="inline-flex flex-wrap items-center gap-x-1">
                {row.assignee?.name ?? "Sin asignar"}
                {showSupervisorReassign && row.assigneeUserId ? (
                  <SupervisorReassignControl
                    caseId={row.id}
                    version={row.version}
                    assigneeUserId={row.assigneeUserId}
                    candidates={candidates}
                    assignCaseAction={assignCaseAction}
                  />
                ) : null}
              </span>
            </EntityMetaItem>
            <EntityMetaItem label="Prioridad">{row.attention.priorityName}</EntityMetaItem>
            <EntityMetaItem label="SLA">{row.slaDueAt ? formatWhen(row.slaDueAt) : "Aún no inicia"}</EntityMetaItem>
            <EntityMetaItem label="Atención">
              {repairAfterDiagnosis ? "Reparación" : ATTENTION_LABEL[row.attention.attentionType as AttentionType] ?? row.attention.attentionType}
            </EntityMetaItem>
          </>
        }
        primaryAction={
          primaryAction || headerAssignmentForm
            ? (
              <div className="flex flex-wrap items-center gap-2">
                {primaryAction}
                {headerAssignmentForm}
              </div>
            )
            : null
        }
        secondaryActions={
          <nav className="flex max-w-full flex-wrap items-center justify-end gap-2" aria-label="Relaciones de la atención">
            {relatedLinks.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[#38506c] transition hover:border-[#91b7cf] hover:text-[var(--accent)]">
                {item.label}
              </Link>
            ))}
          </nav>
        }
      />
      {readOnly ? <p className="mb-4 text-sm text-[var(--muted)]">Consulta de solo lectura. SYSTRON no modifica el estado ni la bitácora de Servomotores.</p> : null}
      <DetailGrid>
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-medium">Bitácora</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Las entradas no se editan ni se borran. Una corrección es una entrada nueva.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {row.logs.map((item) => (
                <li key={item.id} className="border-t border-[var(--line)] pt-2">
                  <span className="text-[var(--muted)]">{formatWhen(item.createdAt)} · {names.get(item.authorUserId) ?? "—"}</span>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
            {canWork && !closed ? (
              <form action={logAction} className="mt-3 grid gap-2">
                <input type="hidden" name="caseId" value={row.id} />
                <textarea name="body" required rows={3} className={controlClass} placeholder="Avance, hallazgo, prueba o incidencia" />
                <Button type="submit" tone="ghost">Agregar entrada</Button>
              </form>
            ) : null}
          </Card>
          <div id="refacciones" className="scroll-mt-6">{partsSection}</div>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {showExitWithoutDocument && !enablingBilling ? (
            <Card className="p-4 text-sm">
              <h2 className="font-medium">Salida sin documento</h2>
              <p className="mt-1 text-[var(--muted)]">
                Si aún no hay remisión ni factura, solicita autorización al CEO para que almacén registre la entrega.
              </p>
              <div className="mt-3">
                <RequestExitWithoutDocumentButton
                  caseId={row.id}
                  version={row.version}
                  pending={exitPending}
                  authorized={exitAuthorized}
                />
              </div>
            </Card>
          ) : null}
          <HistoryTimeline
            items={historyTimelineItems}
            title={historyTimelineItems.length > caseHistoryItems.length ? "Historial completo" : undefined}
            description={
              historyTimelineItems.length > caseHistoryItems.length
                ? "Atención, movimientos, diagnóstico, cotización y esta operación."
                : undefined
            }
          />
          {false ? (
            <>
          {row.kind === "DIAGNOSTICO" ? (
            <Card className="p-4 text-sm">
              <h2 className="font-medium">Refacciones previstas</h2>
              <p className="mt-1 text-[var(--muted)]">
                Presolicitud durante el diagnóstico. Si el cliente autoriza, pasan a la orden de servicio.
              </p>
              {row.presolicitudes.length === 0 ? (
                <p className="mt-2 text-[var(--muted)]">Sin presolicitudes.</p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {row.presolicitudes.map((item) => (
                    <li key={item.id} className="border-t border-[var(--line)] pt-2">
                      <p>
                        {item.partNumber} · {item.description} · {PRESOLICITUD_LABEL[item.status] ?? item.status}
                      </p>
                      <p className="text-[var(--muted)]">
                        Cantidad {item.qtyRequested}
                        {item.link ? (
                          <>
                            {" "}
                            ·{" "}
                            <a href={item.link} className="text-[var(--accent)]" target="_blank" rel="noreferrer">
                              Referencia
                            </a>
                          </>
                        ) : null}
                      </p>
                      {canEditPresolicitud && item.status === "ACTIVA" ? (
                        <div className="mt-2 space-y-2">
                          <form action={updatePresolicitudAction} className="grid gap-2">
                            <input type="hidden" name="caseId" value={row.id} />
                            <input type="hidden" name="presolicitudId" value={item.id} />
                            <Field label="Número de parte">
                              <input name="partNumber" required defaultValue={item.partNumber} className={controlClass} />
                            </Field>
                            <Field label="Descripción">
                              <input name="description" required defaultValue={item.description} className={controlClass} />
                            </Field>
                            <Field label="Liga opcional">
                              <input name="link" defaultValue={item.link ?? ""} className={controlClass} />
                            </Field>
                            <Field label="Cantidad">
                              <input name="quantity" type="number" min={1} required defaultValue={item.qtyRequested} className={controlClass} />
                            </Field>
                            <Button type="submit" tone="ghost" className="sticky bottom-3 z-30 shadow-[0_8px_22px_rgba(20,45,75,0.14)]">
                              Guardar
                            </Button>
                          </form>
                          <form action={deletePresolicitudAction}>
                            <input type="hidden" name="caseId" value={row.id} />
                            <input type="hidden" name="presolicitudId" value={item.id} />
                            <Button type="submit" tone="ghost">
                              Quitar
                            </Button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canEditPresolicitud ? (
                <form action={createPresolicitudAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="caseId" value={row.id} />
                  <Field label="Número de parte">
                    <input name="partNumber" required className={controlClass} />
                  </Field>
                  <Field label="Descripción">
                    <input name="description" required className={controlClass} />
                  </Field>
                  <Field label="Liga opcional">
                    <input name="link" className={controlClass} />
                  </Field>
                  <Field label="Cantidad">
                    <input name="quantity" type="number" min={1} required className={controlClass} />
                  </Field>
                  <Button type="submit" tone="ghost">
                    Agregar
                  </Button>
                </form>
              ) : null}
            </Card>
          ) : null}
          {row.kind === "OS" ? (
            <Card className="p-4 text-sm">
              <h2 className="font-medium">Refacciones</h2>
              {row.requests.length === 0 ? <p className="mt-2 text-[var(--muted)]">Sin solicitudes.</p> : (
                <ul className="mt-2 space-y-3">
                  {row.requests.map((request) => (
                    <li key={request.id}>
                      <p>{request.partNumber} · {request.description} · {request.status}</p>
                      <p className="text-[var(--muted)]">Solicitada {request.qtyRequested} · recibida {request.qtyReceived} · surtida {request.qtyIssued}</p>
                      {canOperatePartRequests ? (
                        <div className="mt-1 flex flex-wrap gap-2">
                          <form action={receivePartAction} className="flex gap-1">
                            <input type="hidden" name="caseId" value={row.id} />
                            <input type="hidden" name="requestId" value={request.id} />
                            <input type="hidden" name="version" value={request.version} />
                            <input name="quantity" type="number" min={1} required className="w-16 rounded-md border border-[var(--line)] px-2 py-1" />
                            <Button type="submit" tone="ghost">Recibir</Button>
                          </form>
                          <form action={issuePartAction} className="flex gap-1">
                            <input type="hidden" name="caseId" value={row.id} />
                            <input type="hidden" name="requestId" value={request.id} />
                            <input type="hidden" name="version" value={request.version} />
                            <input name="quantity" type="number" min={1} required className="w-16 rounded-md border border-[var(--line)] px-2 py-1" />
                            <Button type="submit" tone="ghost">Surtir</Button>
                          </form>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {canOperatePartRequests ? (
                <form action={requestPartAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="caseId" value={row.id} />
                  <Field label="Número de parte"><input name="partNumber" required className={controlClass} /></Field>
                  <Field label="Descripción"><input name="description" required className={controlClass} /></Field>
                  <Field label="Liga opcional"><input name="link" className={controlClass} /></Field>
                  <Field label="Cantidad"><input name="quantity" type="number" min={1} required className={controlClass} /></Field>
                  <Button type="submit" tone="ghost">Solicitar refacción</Button>
                </form>
              ) : presolicitudOnly && !closed ? (
                <p className="mt-3 text-[var(--muted)]">
                  En reparación las solicitudes formales las registra gerencia o almacén. En diagnóstico usa presolicitudes arriba.
                </p>
              ) : null}
            </Card>
          ) : null}
            </>
          ) : null}
          {!readOnly ? (
            <>
            {closed && canManage ? (
              <FormPanel action={reopenAction}>
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <FormSection title="Reabrir" columns={1}>
                  <Field label="Motivo"><input name="reason" required className={controlClass} placeholder="Motivo" /></Field>
                </FormSection>
                <FormActions><Button type="submit" tone="ghost">Reabrir</Button></FormActions>
              </FormPanel>
            ) : null}
            {row.kind === "OS" && row.status === "TERMINADA" && row.attention.attentionType !== "DIAGNOSTICO_GARANTIA" && !row.paidAt && (session.role === "CEO" || session.role === "ADMINISTRADOR") ? (
              <form action={markPaidAction}>
                <input type="hidden" name="caseId" value={row.id} />
                <Button type="submit" tone="ghost">Marcar reparación pagada</Button>
              </form>
            ) : null}
            {row.warrantyDecision === "NO_PROCEDENTE" && !row.commercialDecision && (session.role === "CEO" || session.role === "ADMINISTRADOR") ? (
              <FormPanel id="decision-comercial" action={overrideWarrantyAction} className="scroll-mt-24">
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <FormSection title="Decisión comercial" columns={1}>
                  <Field label="Decisión">
                    <select name="decision" className={controlClass}>
                      <option value="VALIDA">Aceptar como garantía</option>
                      <option value="COTIZAR">Enviar a cotización</option>
                    </select>
                  </Field>
                  <Field label="Motivo"><input name="reason" required className={controlClass} placeholder="Motivo" /></Field>
                </FormSection>
                <FormActions><Button type="submit">Guardar decisión</Button></FormActions>
              </FormPanel>
            ) : null}
            </>
          ) : null}
        </aside>
      </DetailGrid>
    </>
  );
}
