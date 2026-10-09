import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import {
  ActionLink,
  ActiveFilters,
  Badge,
  Button,
  controlClass,
  Empty,
  FilterBar,
  MobileCard,
  PageHeader,
  RecordLink,
  ResponsiveData,
  SegmentedNav,
  Table,
  Td,
  Th,
  TextLink,
} from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { homePath } from "@/lib/home";
import { requireCompany } from "@/lib/session";

function salePending(sale: { lines: Array<{ qtySold: number; qtyReceived: number; qtyDelivered: number }> }) {
  const pendingReceive = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtySold - line.qtyReceived), 0);
  const pendingDeliver = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtyReceived - line.qtyDelivered), 0);
  const pendingLabel = pendingReceive > 0 ? `Recibir ${pendingReceive}` : pendingDeliver > 0 ? `Entregar ${pendingDeliver}` : "Al día";
  return { pendingReceive, pendingDeliver, pendingLabel };
}

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ vista?: string; q?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "agenda.use", session.activeCompanyCode) && !can(session.role, "quote.follow", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { vista, q } = await searchParams;
  const view = vista === "pendientes" ? "pendientes" : vista === "al_dia" ? "al_dia" : "todas";
  const query = (q ?? "").trim();
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const own = session.role === "VENTAS" ? { quote: { sellerUserId: session.userId } } : {};
  let sales = await prisma.sale.findMany({
    where: { companyId: session.activeCompanyId, ...own },
    include: { client: true, quote: true, lines: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  if (query) {
    const lower = query.toLowerCase();
    sales = sales.filter(
      (sale) =>
        sale.folio.toLowerCase().includes(lower)
        || sale.client.name.toLowerCase().includes(lower)
        || sale.quote.folio.toLowerCase().includes(lower),
    );
  }
  if (view === "pendientes") {
    sales = sales.filter((sale) => {
      const { pendingReceive, pendingDeliver } = salePending(sale);
      return pendingReceive > 0 || pendingDeliver > 0;
    });
  } else if (view === "al_dia") {
    sales = sales.filter((sale) => {
      const { pendingReceive, pendingDeliver } = salePending(sale);
      return pendingReceive === 0 && pendingDeliver === 0;
    });
  }
  const vistaLabel = view === "pendientes" ? "Con pendientes" : view === "al_dia" ? "Al día" : null;

  return (
    <>
      <PageHeader
        title="Venta de equipos"
        subtitle="Ventas autorizadas de tu cartera. Recepción y entrega se confirman en el detalle."
        back={session.role === "VENTAS" ? { href: "/panel", label: "Inicio" } : undefined}
        action={can(session.role, "quote.create", session.activeCompanyCode) ? <ActionLink href="/ventas/nuevo">Nueva venta de equipo</ActionLink> : null}
      />
      <SegmentedNav
        items={[
          { href: listHref("/ventas", { q: query || undefined }), label: "Todas", active: view === "todas" },
          { href: listHref("/ventas", { vista: "pendientes", q: query || undefined }), label: "Con pendientes", active: view === "pendientes" },
          { href: listHref("/ventas", { vista: "al_dia", q: query || undefined }), label: "Al día", active: view === "al_dia" },
        ]}
      />
      <FilterBar action="/ventas">
        {view !== "todas" ? <input type="hidden" name="vista" value={view} /> : null}
        <input name="q" defaultValue={query} placeholder="Folio, cliente o cotización" className={`${controlClass} sm:flex-1`} />
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(vistaLabel ? [{ label: vistaLabel, clearHref: listHref("/ventas", { q: query || undefined }) }] : []),
          ...(query ? [{ label: `Búsqueda: ${query}`, clearHref: listHref("/ventas", { vista: view !== "todas" ? view : undefined }) }] : []),
        ]}
      />
      {sales.length === 0 ? (
        <Empty
          title={query || view !== "todas" ? "Sin coincidencias" : "Sin ventas de equipo"}
          body={
            query || view !== "todas"
              ? "Nada coincide con el filtro en esta empresa."
              : "Inicia una cotización de venta de equipo; cuando el cliente autorice, el folio VTA aparece aquí."
          }
          action={
            query || view !== "todas"
              ? <TextLink href="/ventas">Quitar filtros</TextLink>
              : can(session.role, "quote.create", session.activeCompanyCode)
                ? <TextLink href="/ventas/nuevo">Nueva venta de equipo</TextLink>
                : undefined
          }
        />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Folio</Th><Th>Cliente</Th><Th>Cotización</Th><Th>Pendiente</Th></tr></thead>
              <tbody>
                {sales.map((sale) => {
                  const { pendingLabel } = salePending(sale);
                  return (
                    <tr key={sale.id}>
                      <Td><RecordLink href={`/ventas/${sale.id}`}>{sale.folio}</RecordLink></Td>
                      <Td><ClientNameLink clientId={sale.client.id} name={sale.client.name} isSystem={sale.client.isSystem} canEdit={canEditClient} /></Td>
                      <Td><TextLink href={`/cotizaciones/${sale.quoteId}`}>{sale.quote.folio}</TextLink></Td>
                      <Td><Badge>{pendingLabel}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={sales.map((sale) => {
            const { pendingLabel } = salePending(sale);
            return (
              <MobileCard
                key={sale.id}
                href={`/ventas/${sale.id}`}
                title={sale.folio}
                meta={<Badge>{pendingLabel}</Badge>}
                footer={
                  <>
                    <p><ClientNameLink clientId={sale.client.id} name={sale.client.name} isSystem={sale.client.isSystem} canEdit={canEditClient} /></p>
                    <p className="mt-1">Cotización <TextLink href={`/cotizaciones/${sale.quoteId}`}>{sale.quote.folio}</TextLink></p>
                  </>
                }
              />
            );
          })}
        />
      )}
    </>
  );
}
