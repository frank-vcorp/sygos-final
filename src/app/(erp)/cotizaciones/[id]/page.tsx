import { notFound, redirect } from "next/navigation";
import { requestDocumentAction, requestIntercompanyAction } from "@/app/(erp)/facturacion/actions";
import { decideAction, discountAction, linkBaseAction, relateEquipmentAction, sendQuoteMailAction, setPricesAction } from "../actions";
import { RelateEquipmentForm } from "@/components/relate-equipment-form";
import { HistoryTimeline } from "@/components/history-timeline";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import {
  Badge,
  controlClass,
  DetailAnchorButton,
  DetailGrid,
  EntityDetailHeader,
  EntityMetaItem,
  Field,
  inlineLinkClass,
  TextLink,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { linesForTotal, money, quoteTotals } from "@/lib/money";
import { can } from "@/lib/permissions";
import { QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, seesEconomicDetail, type QuoteType } from "@/lib/quotes";
import { ClientNameLink, ContactNameLink } from "@/components/client-entity-links";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

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
  const history = await historyFor("COTIZACION", quote.id);
  const seller = await prisma.user.findUnique({ where: { id: session.userId }, select: { discountLimitPct: true } });
  const source = quote.technicalCaseId
    ? await prisma.technicalCase.findUnique({ where: { id: quote.technicalCaseId }, include: { attention: true } })
    : null;
  const repairOrder = source
    ? await prisma.technicalCase.findFirst({ where: { spawnedFromId: source.id, kind: "OS" } })
    : null;
  const referencePrice = source?.attention.priorityPrice;
  const priced = quote.status !== "PENDIENTE_COTIZAR" || session.role !== "VENTAS";
  const totals = priced ? quoteTotals(linesForTotal(quote.lines, quote.quoteType, quote.status), quote.discountPct) : null;
  const waitingEquipment = quote.status === "AUTORIZADA_PENDIENTE_EQUIPO" && !quote.equipmentId && !quote.technicalCaseId && (quote.quoteType === "DIAGNOSTICO" || quote.quoteType === "REPARACION");
  const [gear, priorities, types, brands, models] = waitingEquipment
    ? await Promise.all([
        prisma.equipment.findMany({ where: { originCompanyId: session.activeCompanyId, clientId: quote.clientId }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.priority.findMany({ where: { companyId: session.activeCompanyId, attentionType: quote.quoteType, active: true }, orderBy: { sortOrder: "asc" } }),
        prisma.catalogType.findMany({ orderBy: { name: "asc" } }),
        prisma.catalogBrand.findMany({ orderBy: { name: "asc" } }),
        prisma.catalogModel.findMany({ include: { type: true, brand: true } }),
      ])
    : [[], [], [], [], []];
  const allowQuickEquipment = can(session.role, "equi.create", session.activeCompanyCode) || can(session.role, "mot.create", session.activeCompanyCode);
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
    primaryAction = <DetailAnchorButton href="#decision-cliente">Registrar decisión del cliente</DetailAnchorButton>;
  } else if (waitingEquipment && can(session.role, "quote.follow", session.activeCompanyCode)) {
    primaryAction = <DetailAnchorButton href="#relacionar-equipo">Relacionar equipo</DetailAnchorButton>;
  }

  const equipmentLabel = quote.equipment
    ? quote.equipment.folio
    : [quote.preliminaryType, quote.preliminaryBrand, quote.preliminaryModel, quote.preliminarySerial].filter(Boolean).join(" · ") || "Sin equipo físico";

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
      <DetailGrid>
        <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
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
                  <button className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">Solicitar factura a SYSTRON</button>
                </form>
              ) : !quote.client.isSystem ? (
                <>
                  <form action={requestDocumentAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="kind" value="FACTURA" />
                    <button className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">Solicitar factura</button>
                  </form>
                  <form action={requestDocumentAction}>
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input type="hidden" name="kind" value="REMISION" />
                    <button className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">Solicitar remisión</button>
                  </form>
                </>
              ) : null}
            </div>
          ) : null}
          {base ? <p className="mt-3 text-[var(--muted)]">Base Servomotores {base.folio}: {money(quoteTotals(base.lines, base.discountPct)?.total)}. El vendedor no ve este importe.</p> : null}
        </section>
        <div className="space-y-4">
          {quote.status === "PENDIENTE_COTIZAR" && can(session.role, "quote.price", session.activeCompanyCode) ? (
            <form id="asignar-precio" action={setPricesAction} className="grid scroll-mt-24 gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
              <h2 className="font-medium">Asignar precio</h2>
              <input type="hidden" name="quoteId" value={quote.id} />
              <input type="hidden" name="version" value={quote.version} />
              {quote.lines.map((line) => (
                <Field key={line.id} label={line.incrementPct != null ? `${line.concept} · base, incremento ${line.incrementPct}%` : line.concept}>
                  <input type="hidden" name="lineId" value={line.id} />
                  <input name="amount" required inputMode="decimal" defaultValue={referencePrice ?? ""} className={controlClass} />
                </Field>
              ))}
              <SubmitButton>Guardar precio</SubmitButton>
            </form>
          ) : null}
          {quote.status === "PENDIENTE_DECISION" && can(session.role, "quote.follow", session.activeCompanyCode) ? (
            <>
              <form action={discountAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
                <h2 className="font-medium">Descuento</h2>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="version" value={quote.version} />
                <Field label="Porcentaje" hint={seller?.discountLimitPct != null ? `Tu límite es ${seller.discountLimitPct}%.` : "Tu usuario no tiene un tope de descuento."}>
                  <input name="discountPct" required defaultValue={quote.discountPct} className={controlClass} />
                </Field>
                <SubmitButton tone="ghost">Aplicar</SubmitButton>
              </form>
              <form id="decision-cliente" action={decideAction} className="grid scroll-mt-24 gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
                <h2 className="font-medium">Decisión del cliente</h2>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="version" value={quote.version} />
                {quote.quoteType === "VENTA_EQUIPO" ? (
                  <div className="grid gap-1">
                    <p className="text-xs text-[var(--muted)]">Marca las líneas que el cliente autorizó.</p>
                    {quote.lines.map((line) => (
                      <label key={line.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="authorizedLine" value={line.id} /> {line.concept}</label>
                    ))}
                  </div>
                ) : null}
                <select name="decision" className={controlClass}>
                  <option value="si">Autorizada</option>
                  <option value="no">No autorizada</option>
                </select>
                <ConfirmSubmit tone="primary" message="Se registrará la decisión del cliente. Revisa que sea la correcta.">Registrar decisión</ConfirmSubmit>
              </form>
            </>
          ) : null}
          {waitingEquipment && can(session.role, "quote.follow", session.activeCompanyCode) ? (
            <div id="relacionar-equipo" className="scroll-mt-24">
            <RelateEquipmentForm
              quoteId={quote.id}
              version={quote.version}
              clientId={quote.clientId}
              gear={gear.map((item) => ({ id: item.id, folio: item.folio, model: item.model, clientId: quote.clientId, kind: item.kind }))}
              priorities={priorities.map((item) => ({ id: item.id, name: item.name }))}
              companyCode={session.activeCompanyCode}
              allowQuickEquipment={allowQuickEquipment}
              types={types.map((type) => type.name)}
              brands={brands.map((brand) => brand.name)}
              models={models.map((row) => ({ type: row.type.name, brand: row.brand.name, model: row.name }))}
              relateAction={relateEquipmentAction}
            />
            </div>
          ) : null}
          {session.activeCompanyCode === "SYSTRON" && quote.equipment?.kind === "MOT" && can(session.role, "quote.price", session.activeCompanyCode) ? (
            <form action={linkBaseAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
              <h2 className="font-medium">Ligar cotización base</h2>
              <input type="hidden" name="quoteId" value={quote.id} />
              <Field label="Cotización de Servomotores" hint="Pega el folio o el identificador de la cotización base.">
                <input name="baseQuoteId" required placeholder="COT-… o identificador" className={controlClass} />
              </Field>
              <SubmitButton tone="ghost">Ligar</SubmitButton>
            </form>
          ) : null}
          <HistoryTimeline items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
        </div>
      </DetailGrid>
    </>
  );
}
