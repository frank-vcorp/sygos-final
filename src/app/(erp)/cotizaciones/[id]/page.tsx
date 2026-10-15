import { notFound, redirect } from "next/navigation";
import { requestDocumentAction, requestIntercompanyAction } from "@/app/(erp)/facturacion/actions";
import { decideAction, discountAction, linkBaseAction, relateEquipmentAction, sendQuoteMailAction, setPricesAction, updateGeneratedConceptAction } from "../actions";
import { RelateEquipmentForm } from "@/components/relate-equipment-form";
import { HistoryTimeline } from "@/components/history-timeline";
import { QuoteDecisionActions } from "@/components/quote-decision-actions";
import { SubmitButton } from "@/components/submit-button";
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
  inlineLinkClass,
  TextLink,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { attentionMetrics, elapsedLabel } from "@/lib/attention-timing";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { linesForTotal, money, quoteTotals } from "@/lib/money";
import { can } from "@/lib/permissions";
import { PRESOLICITUD_LABEL } from "@/lib/part-presolicitud";
import { ATTENTION_LABEL, type AttentionType } from "@/lib/priorities";
import { QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, seesEconomicDetail, type QuoteType } from "@/lib/quotes";
import { ClientNameLink, ContactNameLink } from "@/components/client-entity-links";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";
import { PART_REQUEST_STATUS_LABEL } from "@/lib/case-labels";
import { CASE_STATUS_LABEL } from "@/lib/technical";

export default async function CotizacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { client: { include: { contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { name: "asc" }] } } }, lines: true, sales: true, company: true, equipment: true },
  });
  if (!quote) notFound();
  await redirectIfSalesNotAssigned(session, quote.sellerUserId, "/cotizaciones");
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const base = quote.linkedQuoteId && (session.role === "ADMINISTRADOR" || session.role === "CEO")
    ? await prisma.quote.findUnique({ where: { id: quote.linkedQuoteId }, include: { lines: true, company: true } })
    : null;
  const [history, seller, source] = await Promise.all([
    historyFor("COTIZACION", quote.id),
    prisma.user.findUnique({ where: { id: session.userId }, select: { discountLimitPct: true } }),
    quote.technicalCaseId
      ? prisma.technicalCase.findUnique({ where: { id: quote.technicalCaseId }, include: { attention: true } })
      : null,
  ]);
  const executiveTimingAttention = session.role === "CEO" && source
    ? await prisma.attention.findUnique({
        where: { id: source.attentionId },
        include: {
          movements: { where: { cancelledAt: null }, orderBy: { occurredAt: "asc" } },
          technicalCases: {
            orderBy: { createdAt: "asc" },
            include: {
              logs: { orderBy: { createdAt: "asc" } },
              requests: { orderBy: { createdAt: "asc" } },
              presolicitudes: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      })
    : null;
  const executiveCaseIds = executiveTimingAttention?.technicalCases.map((item) => item.id) ?? [];
  const [executiveOperationHistory, executiveAttentionHistory] = executiveTimingAttention
    ? await Promise.all([
        prisma.functionalHistory.findMany({
          where: { entityType: "OPERACION", entityId: { in: executiveCaseIds } },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        }),
        historyFor("ATENCION", executiveTimingAttention.id),
      ])
    : [[], []];
  const executiveAuthorIds = executiveTimingAttention
    ? [
        executiveTimingAttention.createdByUserId,
        ...executiveTimingAttention.movements.map((item) => item.authorUserId),
        ...executiveTimingAttention.technicalCases.flatMap((item) => item.logs.map((log) => log.authorUserId)),
      ].filter((id): id is string => Boolean(id))
    : [];
  const executiveAuthors = executiveAuthorIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: executiveAuthorIds } }, select: { id: true, name: true } })
    : [];
  const repairOrder = source
    ? await prisma.technicalCase.findFirst({ where: { spawnedFromId: source.id, kind: "OS" } })
    : null;
  const referencePrice = source?.attention.priorityPrice;
  const priced = quote.status !== "PENDIENTE_COTIZAR" || session.role !== "VENTAS";
  const totals = priced ? quoteTotals(linesForTotal(quote.lines, quote.quoteType, quote.status), quote.discountPct) : null;
  const waitingEquipment = quote.status === "AUTORIZADA_PENDIENTE_EQUIPO" && !quote.equipmentId && !quote.technicalCaseId && (quote.quoteType === "DIAGNOSTICO" || quote.quoteType === "REPARACION");
  const [gear, priorities, types, brands, models] = waitingEquipment
    ? await Promise.all([
        prisma.equipment.findMany({ where: { originCompanyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}) }, orderBy: { createdAt: "desc" }, select: { id: true, folio: true, model: true, clientId: true, kind: true, typeName: true, brandName: true, serial: true } }),
        prisma.priority.findMany({ where: { companyId: session.activeCompanyId, attentionType: quote.quoteType, active: true }, orderBy: { sortOrder: "asc" } }),
        prisma.catalogType.findMany({ orderBy: { name: "asc" } }),
        prisma.catalogBrand.findMany({ orderBy: { name: "asc" } }),
        prisma.catalogModel.findMany({ include: { type: true, brand: true } }),
      ])
    : [[], [], [], [], []];
  const quickEquipmentKinds: Array<"EQUI" | "MOT"> = [
    ...(can(session.role, "equi.create", session.activeCompanyCode) ? ["EQUI" as const] : []),
    ...(can(session.role, "mot.create", session.activeCompanyCode) ? ["MOT" as const] : []),
  ];
  const showBase = seesEconomicDetail(session.role, session.activeCompanyCode, quote.company.code, false);
  const missing = quote.status === "PENDIENTE_COTIZAR"
    ? "Falta el precio de CEO o Administrador."
    : quote.status === "PENDIENTE_DECISION"
      ? "Falta la decisión del cliente."
        : quote.status === "AUTORIZADA_PENDIENTE_EQUIPO"
        ? quote.equipment
          ? "El equipo ya está relacionado. La operación arranca con la entrada física. Todavía no hay orden de servicio."
          : "Falta crear o relacionar el equipo y confirmar su ingreso. Todavía no hay orden de servicio."
        : null;

  let primaryAction: React.ReactNode = null;
  if (quote.status === "PENDIENTE_COTIZAR" && can(session.role, "quote.price", session.activeCompanyCode)) {
    primaryAction = <DetailAnchorButton href="#asignar-precio">Asignar precio</DetailAnchorButton>;
  } else if (quote.status === "PENDIENTE_DECISION" && can(session.role, "quote.follow", session.activeCompanyCode)) {
    primaryAction = (
      <QuoteDecisionActions
        quoteId={quote.id}
        version={quote.version}
        quoteType={quote.quoteType}
        lines={quote.lines.map((line) => ({ id: line.id, concept: line.concept }))}
        decideAction={decideAction}
      />
    );
  } else if (waitingEquipment && can(session.role, "quote.follow", session.activeCompanyCode)) {
    primaryAction = <DetailAnchorButton href="#relacionar-equipo">Relacionar equipo</DetailAnchorButton>;
  }

  const equipmentLabel = quote.equipment
    ? quote.equipment.folio
    : [quote.preliminaryType, quote.preliminaryBrand, quote.preliminaryModel, quote.preliminarySerial].filter(Boolean).join(" · ") || "Sin equipo físico";
  const executiveReceivedAt = executiveTimingAttention?.movements.find((item) => item.kind === "ENTRADA" || item.kind === "INGRESO")?.occurredAt
    ?? executiveTimingAttention?.slaStartedAt
    ?? null;
  const executiveMetrics = executiveTimingAttention
    ? attentionMetrics({
        attentionCreatedAt: executiveTimingAttention.createdAt,
        receivedAt: executiveReceivedAt,
        operationEvents: executiveOperationHistory,
        quoteCreatedAt: quote.createdAt,
        quoteEvents: history,
      })
    : null;
  const executiveAuthorNames = new Map(executiveAuthors.map((item) => [item.id, item.name]));
  const executiveCaseById = new Map(executiveTimingAttention?.technicalCases.map((item) => [item.id, item]) ?? []);
  const executiveCasesWithOpenHistory = new Set(executiveOperationHistory.filter((item) => item.action === "ALTA").map((item) => item.entityId));
  const executiveAttentionHasOpenHistory = executiveAttentionHistory.some((item) => item.action === "ALTA");
  const executivePartItems = executiveTimingAttention?.technicalCases.flatMap((technicalCase) => [
    ...technicalCase.presolicitudes.map((item) => ({
      id: `presolicitud-${item.id}`,
      caseFolio: technicalCase.folio,
      stage: "Prevista en diagnóstico",
      partNumber: item.partNumber,
      description: item.description,
      quantity: item.qtyRequested,
      status: PRESOLICITUD_LABEL[item.status] ?? item.status,
      link: item.link,
      received: null,
      issued: null,
    })),
    ...technicalCase.requests.map((item) => ({
      id: `request-${item.id}`,
      caseFolio: technicalCase.folio,
      stage: "Solicitud de refacción",
      partNumber: item.partNumber,
      description: item.description,
      quantity: item.qtyRequested,
      status: PART_REQUEST_STATUS_LABEL[item.status] ?? item.status,
      link: item.link,
      received: item.qtyReceived,
      issued: item.qtyIssued,
    })),
  ]) ?? [];
  const executiveLogs = executiveTimingAttention?.technicalCases
    .flatMap((technicalCase) => technicalCase.logs.map((item) => ({
      id: item.id,
      folio: technicalCase.folio,
      body: item.body,
      createdAt: item.createdAt,
      authorName: executiveAuthorNames.get(item.authorUserId),
    })))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) ?? [];
  const executiveAttentionHistoryItems = executiveTimingAttention
    ? [
        ...(!executiveAttentionHasOpenHistory
          ? [{
              id: `attention-${executiveTimingAttention.id}`,
              createdAt: executiveTimingAttention.createdAt,
              summary: `Atención ${ATTENTION_LABEL[executiveTimingAttention.attentionType as AttentionType] ?? executiveTimingAttention.attentionType} abierta · prioridad ${executiveTimingAttention.priorityName}. Falla reportada: ${executiveTimingAttention.reportedFault}`,
              authorName: executiveTimingAttention.createdByUserId ? executiveAuthorNames.get(executiveTimingAttention.createdByUserId) : null,
            }]
          : []),
        ...executiveAttentionHistory
          .filter((item) => item.action !== "ENTRADA_FISICA" && item.action !== "MOVIMIENTO_FISICO")
          .map((item) => ({
            id: `attention-history-${item.id}`,
            createdAt: item.createdAt,
            summary: `Atención · ${item.summary}`,
            authorName: item.author?.name,
          })),
        ...executiveTimingAttention.movements.map((item) => ({
          id: `movement-${item.id}`,
          createdAt: item.occurredAt,
          summary: [
            `Movimiento físico${item.folio ? ` ${item.folio}` : ""}: ${item.kind}`,
            item.reason,
            item.notes,
          ].filter(Boolean).join(" · "),
          authorName: executiveAuthorNames.get(item.authorUserId),
        })),
        ...executiveTimingAttention.technicalCases.flatMap((technicalCase) => [
          ...(!executiveCasesWithOpenHistory.has(technicalCase.id)
            ? [{
                id: `case-${technicalCase.id}`,
                createdAt: technicalCase.createdAt,
                summary: `${technicalCase.folio} · ${technicalCase.kind === "OS" ? "Orden de servicio" : "Diagnóstico"} abierta. Estado actual: ${CASE_STATUS_LABEL[technicalCase.status] ?? technicalCase.status}.`,
                authorName: null,
              }]
            : []),
        ]),
        ...executiveOperationHistory.map((item) => ({
          id: `operation-history-${item.id}`,
          createdAt: item.createdAt,
          summary: `${executiveCaseById.get(item.entityId)?.folio ?? "Operación"} · ${item.summary}`,
          authorName: item.author?.name,
        })),
        ...history.map((item) => ({
          id: `quote-history-${item.id}`,
          createdAt: item.createdAt,
          summary: `${quote.folio} · ${item.summary}`,
          authorName: item.author?.name,
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    : [];

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/cotizaciones", label: "Cotizaciones" }}
        title={quote.folio}
        subtitle={QUOTE_TYPE_LABEL[quote.quoteType as QuoteType] ?? quote.quoteType}
        status={<Badge>{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</Badge>}
        meta={
          <>
            <EntityMetaItem label="Cliente">
              <ClientNameLink clientId={quote.client.id} name={quote.client.name} isSystem={quote.client.isSystem} canEdit={canEditClient} />
            </EntityMetaItem>
            <EntityMetaItem label="Equipo">
              {quote.equipment ? (
                <TextLink href={quote.equipment.kind === "MOT" ? `/motores/${quote.equipment.id}` : `/equipos/${quote.equipment.id}`}>{equipmentLabel}</TextLink>
              ) : (
                equipmentLabel
              )}
            </EntityMetaItem>
            {totals ? <EntityMetaItem label="Total">{money(totals.total)}</EntityMetaItem> : <EntityMetaItem label="Total">Sin precio</EntityMetaItem>}
          </>
        }
        primaryAction={primaryAction}
        secondaryActions={
          <>
            <TextLink href={`/documentos/cotizacion/${quote.id}`}>Imprimir</TextLink>
            <form action={sendQuoteMailAction} className="inline">
              <input type="hidden" name="quoteId" value={quote.id} />
              <button type="submit" className={inlineLinkClass}>Enviar por correo</button>
            </form>
          </>
        }
      />
      {executiveMetrics ? (
        <details className="mb-6 border-y border-[var(--line)] py-3" aria-label="Tiempos de la atención">
          <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)] [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">Tiempos de atención <span className="text-[var(--accent)]">Ver desglose</span></span>
          </summary>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {executiveMetrics.map((metric) => (
              <div key={metric.key} className={metric.active ? "text-[var(--accent)]" : "text-[#38506c]"}>
                <span className="text-xs font-medium text-[var(--muted)]">{metric.label}: </span>
                <span className="text-sm font-semibold">{elapsedLabel(metric.milliseconds)}</span>
                {metric.active ? <span className="ml-1 text-xs">actual</span> : null}
                {metric.estimated ? <span className="ml-1 text-xs text-[var(--muted)]">estimado</span> : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
      <DetailGrid>
        <div className="space-y-4">
          <Card className="p-4 text-sm">
          {source ? <p className="mt-1">{source.kind === "OS" ? "Orden de servicio" : "Diagnóstico de origen"}: <TextLink href={`/operacion/${source.id}`}>{source.folio}</TextLink></p> : null}
          {repairOrder ? <p className="mt-1">Orden de servicio: <TextLink href={`/operacion/${repairOrder.id}`}>{repairOrder.folio}</TextLink></p> : null}
          {quote.client.contacts.length > 0 ? (
            <p className="mt-1">
              Contactos:{" "}
              {quote.client.contacts.map((contact, index) => (
                <span key={contact.id}>
                  {index > 0 ? ", " : ""}
                  <ContactNameLink clientId={quote.client.id} name={contact.name} canEdit={canEditClient} />
                </span>
              ))}
            </p>
          ) : <p className="mt-1 text-[var(--danger)]">Este cliente no tiene contactos activos.</p>}
          {quote.status === "PENDIENTE_COTIZAR" && referencePrice != null ? <p className="mt-1">Referencia congelada de la prioridad: {money(referencePrice)}. El precio lo confirma CEO o Administrador.</p> : null}
          {quote.reference ? <p className="mt-1">Referencia: {quote.reference}</p> : null}
          {quote.creditDays != null ? <p className="mt-1">Crédito congelado: {quote.creditDays} días</p> : null}
          {missing ? <p className="mt-3 rounded-md bg-[var(--warn-soft)] px-3 py-2">{missing}</p> : null}
          <table className="mt-4 min-w-full text-left">
            <thead><tr><th className="py-1">Concepto</th><th>Cant.</th>{priced ? <th>Precio</th> : null}</tr></thead>
            <tbody>
              {quote.lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-1">{line.concept}{quote.status === "AUTORIZADA" && quote.quoteType === "VENTA_EQUIPO" ? (line.authorized ? " · autorizada" : " · no autorizada") : line.authorized ? " · autorizada" : ""}</td>
                  <td>{line.quantity}</td>
                  {priced ? <td>{showBase && line.basePrice != null ? `${money(line.basePrice)} base · final ${money(line.unitPrice)}` : money(line.unitPrice)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
          {totals ? (
            <p className="mt-3">Subtotal {money(totals.subtotal)} · descuento {quote.discountPct}% · IVA {money(totals.iva)} · total {money(totals.total)}</p>
          ) : null}
          {quote.sales.map((sale) => <p key={sale.id} className="mt-2">Venta <TextLink href={`/ventas/${sale.id}`}>{sale.folio}</TextLink></p>)}
          {quote.status === "AUTORIZADA" && can(session.role, "invoice.request", session.activeCompanyCode) ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {quote.client.isSystem && session.activeCompanyCode === "SERVOMOTORES" ? (
                <form action={requestIntercompanyAction}>
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <Button type="submit" tone="ghost">Solicitar factura a SYSTRON</Button>
                </form>
              ) : !quote.client.isSystem ? (
                <>
                  <form action={requestDocumentAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="kind" value="FACTURA" />
                    <Button type="submit" tone="ghost">Solicitar factura</Button>
                  </form>
                  <form action={requestDocumentAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="kind" value="REMISION" />
                    <Button type="submit" tone="ghost">Solicitar remisión</Button>
                  </form>
                </>
              ) : null}
            </div>
          ) : null}
          {base ? <p className="mt-3 text-[var(--muted)]">Base Servomotores {base.folio}: {money(quoteTotals(base.lines, base.discountPct)?.total)}. El vendedor no ve este importe.</p> : null}
          </Card>
          {session.role === "CEO" && executivePartItems.length > 0 ? (
            <Card className="p-5 text-sm">
              <h2 className="font-semibold text-[#0b1f3a]">Refacciones</h2>
              <p className="mt-1 text-[var(--muted)]">Refacciones previstas o solicitadas para esta atención.</p>
              <ul className="mt-3 divide-y divide-[var(--line)]">
                {executivePartItems.map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                      <span>{item.caseFolio}</span>
                      <span aria-hidden>·</span>
                      <span>{item.stage}</span>
                      <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 font-semibold text-[var(--accent)]">{item.status}</span>
                    </div>
                    <p className="mt-1 font-medium text-[#0b1f3a]">{item.partNumber} · {item.description}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Cantidad solicitada: {item.quantity}
                      {item.received != null ? ` · recibidas: ${item.received}` : ""}
                      {item.issued != null ? ` · surtidas: ${item.issued}` : ""}
                      {item.link ? <><span aria-hidden> · </span><a href={item.link} target="_blank" rel="noreferrer" className="text-[var(--accent)]">Referencia</a></> : null}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {session.role === "CEO" && executiveTimingAttention ? (
            <Card className="p-5 text-sm">
              <h2 className="font-semibold text-[#0b1f3a]">Bitácora</h2>
              <p className="mt-1 text-[var(--muted)]">Avances, hallazgos, pruebas e incidencias registrados por el equipo técnico.</p>
              {executiveLogs.length === 0 ? (
                <p className="mt-4 text-[var(--muted)]">Aún no hay entradas técnicas registradas.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--line)]">
                  {executiveLogs.map((item) => (
                    <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-xs text-[var(--muted)]">{formatWhen(item.createdAt)} · {item.folio} · {item.authorName ?? "Sistema"}</p>
                      <p className="mt-1 whitespace-pre-wrap leading-6 text-[#24364d]">{item.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}
        </div>
        <div className="space-y-4">
          {session.role === "CEO" && quote.technicalCaseId && quote.status === "PENDIENTE_COTIZAR" ? (
            <FormPanel action={updateGeneratedConceptAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="version" value={quote.version} />
              <FormSection title="Ajustar concepto" description="Solo CEO. Corrige la redacción técnica antes de asignar precio." columns={1}>
                {quote.lines.map((line) => (
                  <Field key={line.id} label="Concepto">
                    <input type="hidden" name="lineId" value={line.id} />
                    <textarea name="concept" required rows={3} defaultValue={line.concept} className={controlClass} />
                  </Field>
                ))}
              </FormSection>
              <FormActions><SubmitButton tone="ghost">Guardar concepto</SubmitButton></FormActions>
            </FormPanel>
          ) : null}
          {quote.status === "PENDIENTE_COTIZAR" && can(session.role, "quote.price", session.activeCompanyCode) ? (
            <FormPanel id="asignar-precio" action={setPricesAction} className="scroll-mt-24">
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="version" value={quote.version} />
              <FormSection title="Asignar precio" description="Confirma el importe por línea antes de enviar al cliente." columns={1}>
                {quote.lines.map((line) => (
                  <Field key={line.id} label={line.incrementPct != null ? `${line.concept} · base, incremento ${line.incrementPct}%` : line.concept}>
                    <input type="hidden" name="lineId" value={line.id} />
                    <input name="amount" required inputMode="decimal" defaultValue={referencePrice ?? ""} className={controlClass} />
                  </Field>
                ))}
              </FormSection>
              <FormActions><SubmitButton>Guardar precio</SubmitButton></FormActions>
            </FormPanel>
          ) : null}
          {quote.status === "PENDIENTE_DECISION" && can(session.role, "quote.follow", session.activeCompanyCode) ? (
            <>
              <FormPanel action={discountAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="version" value={quote.version} />
                <FormSection title="Descuento" columns={1}>
                  <Field label="Porcentaje" hint={seller?.discountLimitPct != null ? `Tu límite es ${seller.discountLimitPct}%.` : "Tu usuario no tiene un tope de descuento."}>
                    <input name="discountPct" required defaultValue={quote.discountPct} className={controlClass} />
                  </Field>
                </FormSection>
                <FormActions><SubmitButton tone="ghost">Aplicar</SubmitButton></FormActions>
              </FormPanel>
            </>
          ) : null}
          {waitingEquipment && can(session.role, "quote.follow", session.activeCompanyCode) ? (
            <div id="relacionar-equipo" className="scroll-mt-24">
            <RelateEquipmentForm
              quoteId={quote.id}
              version={quote.version}
              clientId={quote.clientId}
              gear={gear}
              priorities={priorities.map((item) => ({ id: item.id, name: item.name }))}
              companyCode={session.activeCompanyCode}
              allowQuickEquipment={quickEquipmentKinds.length > 0}
              quickEquipmentKinds={quickEquipmentKinds}
              types={types.map((type) => type.name)}
              brands={brands.map((brand) => brand.name)}
              models={models.map((row) => ({ type: row.type.name, brand: row.brand.name, model: row.name }))}
              relateAction={relateEquipmentAction}
            />
            </div>
          ) : null}
          {session.activeCompanyCode === "SYSTRON" && quote.equipment?.kind === "MOT" && can(session.role, "quote.price", session.activeCompanyCode) ? (
            <FormPanel action={linkBaseAction}>
              <input type="hidden" name="quoteId" value={quote.id} />
              <FormSection title="Ligar cotización base" description="Vincula la cotización de Servomotores con esta venta SYSTRON." columns={1}>
                <Field label="Cotización de Servomotores" hint="Pega el folio o el identificador de la cotización base.">
                  <input name="baseQuoteId" required placeholder="COT-… o identificador" className={controlClass} />
                </Field>
              </FormSection>
              <FormActions><SubmitButton tone="ghost">Ligar</SubmitButton></FormActions>
            </FormPanel>
          ) : null}
          <HistoryTimeline
            items={session.role === "CEO" && executiveAttentionHistoryItems.length > 0
              ? executiveAttentionHistoryItems
              : history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))}
            title={session.role === "CEO" && executiveAttentionHistoryItems.length > 0 ? "Historial completo" : undefined}
            description={session.role === "CEO" && executiveAttentionHistoryItems.length > 0 ? "Atención, movimientos físicos, diagnóstico y decisiones de cotización." : undefined}
          />
        </div>
      </DetailGrid>
    </>
  );
}
