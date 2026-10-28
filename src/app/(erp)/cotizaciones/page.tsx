import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { CotizacionesListFilter } from "@/components/compact-list-filters";
import { ActionLink, ActiveFilters, Badge, Card, Empty, ListCap, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th, TextLink } from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { linesForTotal, money, quoteTotals } from "@/lib/money";
import { can } from "@/lib/permissions";
import { ensureQuoteFromCase, QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, type QuoteType } from "@/lib/quotes";
import { requireCompany } from "@/lib/session";

export default async function CotizacionesPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "quote.create", session.activeCompanyCode) && !can(session.role, "quote.price", session.activeCompanyCode) && !can(session.role, "quote.follow", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const { vista, q } = await searchParams;
  const query = (q ?? "").trim();
  const pending = vista === "pendientes";
  const decision = vista === "decision";
  if (pending && can(session.role, "quote.price", session.activeCompanyCode)) {
    const missing = await prisma.technicalCase.findMany({
      where: {
        serviceCompanyId: session.activeCompanyId,
        OR: [
          { quotePending: true },
          { status: "VALIDADO", kind: "DIAGNOSTICO", attention: { attentionType: "DIAGNOSTICO" } },
        ],
      },
      select: { id: true },
      take: 50,
    });
    for (const row of missing) {
      const linked = await prisma.quote.findFirst({ where: { technicalCaseId: row.id, companyId: session.activeCompanyId } });
      if (!linked) {
        try {
          await ensureQuoteFromCase(session, row.id);
        } catch {
          // La bandeja conserva la operación si la cotización no pudo nacer.
        }
      }
    }
  }
  const quotes = await prisma.quote.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...(pending ? { status: "PENDIENTE_COTIZAR" } : {}),
      ...(decision ? { status: "PENDIENTE_DECISION" } : {}),
      ...(session.role === "VENTAS" ? { sellerUserId: session.userId } : {}),
      ...(query ? { OR: [{ folio: { contains: query } }, { client: { name: { contains: query } } }] } : {}),
    },
    include: { client: true, lines: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const cases = pending && can(session.role, "quote.price", session.activeCompanyCode)
    ? await prisma.technicalCase.findMany({
        where: { serviceCompanyId: session.activeCompanyId, quotePending: true, NOT: { id: { in: (await prisma.quote.findMany({ where: { technicalCaseId: { not: null }, companyId: session.activeCompanyId }, select: { technicalCaseId: true } })).map((row) => row.technicalCaseId).filter((id): id is string => Boolean(id)) } } },
        include: { equipment: true },
        take: 50,
      })
    : [];
  return (
    <>
      <PageHeader
        title={pending ? "Pendientes de cotizar" : decision ? "Esperando decisión del cliente" : "Cotizaciones"}
        subtitle={session.role === "VENTAS" ? "Consulta el avance de tus propuestas y da seguimiento a las que esperan respuesta del cliente." : "Revisa las propuestas que necesitan precio y las que esperan respuesta del cliente."}
        action={can(session.role, "quote.create", session.activeCompanyCode) ? <ActionLink href="/cotizaciones/nuevo">Nueva cotización</ActionLink> : null}
      />
      <CotizacionesListFilter vista={pending ? "pendientes" : decision ? "decision" : "todas"} q={query} />
      <ActiveFilters
        items={[
          ...(pending ? [{ label: "Pendientes de cotizar", clearHref: listHref("/cotizaciones", { q: query || undefined }) }] : []),
          ...(decision ? [{ label: "Decisión del cliente", clearHref: listHref("/cotizaciones", { q: query || undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: listHref("/cotizaciones", { vista: pending ? "pendientes" : decision ? "decision" : undefined }) }] : []),
        ]}
      />
      {cases.length > 0 ? (
        <Card className="mb-4 divide-y divide-[var(--line)] overflow-hidden">
          {cases.map((row) => (
            <div key={row.id} className="px-4 py-3 text-sm">
              <RecordLink href={`/operacion/${row.id}`}>{row.folio}</RecordLink>
              <span className="text-[var(--muted)]"> · {row.equipment.folio} aún no tiene cotización</span>
            </div>
          ))}
        </Card>
      ) : null}
      {quotes.length === 0 ? (
        <Empty
          title={query ? "Sin coincidencias" : "Sin cotizaciones"}
          body={query ? `Nada coincide con «${query}».` : "Una cotización nace del vendedor o de una operación que ya puede tener precio."}
          action={query ? <TextLink href={pending ? "/cotizaciones?vista=pendientes" : "/cotizaciones"}>Quitar búsqueda</TextLink> : can(session.role, "quote.create", session.activeCompanyCode) ? <TextLink href="/cotizaciones/nuevo">Nueva cotización</TextLink> : undefined}
        />
      ) : (
        <ResponsiveData table={<Table>
          <thead><tr><Th>Folio</Th><Th>Cliente</Th><Th>Tipo</Th><Th>Estado</Th><Th>Total</Th></tr></thead>
          <tbody>
            {quotes.map((quote) => {
              const hidePrice = session.role === "VENTAS" && quote.status === "PENDIENTE_COTIZAR";
              const totals = hidePrice ? null : quoteTotals(linesForTotal(quote.lines, quote.quoteType, quote.status), quote.discountPct);
              return (
                <tr key={quote.id}>
                  <Td><RecordLink href={`/cotizaciones/${quote.id}`}>{quote.folio}</RecordLink></Td>
                  <Td><ClientNameLink clientId={quote.client.id} name={quote.client.name} isSystem={quote.client.isSystem} canEdit={canEditClient} /></Td>
                  <Td>{QUOTE_TYPE_LABEL[quote.quoteType as QuoteType] ?? quote.quoteType}</Td>
                  <Td><Badge tone={quote.status === "PENDIENTE_DECISION" ? "warn" : quote.status.startsWith("AUTORIZADA") ? "ok" : quote.status === "NO_AUTORIZADA" ? "danger" : "neutral"}>{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</Badge></Td>
                  <Td>{hidePrice ? "Sin precio" : money(totals?.total)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>} cards={quotes.map((quote) => {
          const hidePrice = session.role === "VENTAS" && quote.status === "PENDIENTE_COTIZAR";
          const totals = hidePrice ? null : quoteTotals(linesForTotal(quote.lines, quote.quoteType, quote.status), quote.discountPct);
          return (
            <MobileCard
              key={quote.id}
              href={`/cotizaciones/${quote.id}`}
              title={quote.folio}
              meta={<Badge tone={quote.status === "PENDIENTE_DECISION" ? "warn" : quote.status.startsWith("AUTORIZADA") ? "ok" : quote.status === "NO_AUTORIZADA" ? "danger" : "neutral"}>{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</Badge>}
              footer={<ClientNameLink clientId={quote.client.id} name={quote.client.name} isSystem={quote.client.isSystem} canEdit={canEditClient} />}
            >
              <p>{QUOTE_TYPE_LABEL[quote.quoteType as QuoteType] ?? quote.quoteType} · {hidePrice ? "Sin precio" : money(totals?.total)}</p>
            </MobileCard>
          );
        })} />
      )}
      <ListCap shown={quotes.length} />
    </>
  );
}
