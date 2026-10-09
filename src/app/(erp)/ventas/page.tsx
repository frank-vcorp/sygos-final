import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { ActionLink, Badge, Empty, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, Th, TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { homePath } from "@/lib/home";
import { requireCompany } from "@/lib/session";

export default async function VentasPage() {
  const session = await requireCompany();
  if (!can(session.role, "agenda.use", session.activeCompanyCode) && !can(session.role, "quote.follow", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const own = session.role === "VENTAS" ? { quote: { sellerUserId: session.userId } } : {};
  const sales = await prisma.sale.findMany({
    where: { companyId: session.activeCompanyId, ...own },
    include: { client: true, quote: true, lines: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        title="Venta de equipos"
        subtitle="Ventas autorizadas de tu cartera. Recepción y entrega se confirman en el detalle."
        back={session.role === "VENTAS" ? { href: "/panel", label: "Inicio" } : undefined}
        action={can(session.role, "quote.create", session.activeCompanyCode) ? <ActionLink href="/ventas/nuevo">Nueva venta de equipo</ActionLink> : null}
      />
      {sales.length === 0 ? (
        <Empty
          title="Sin ventas de equipo"
          body="Inicia una cotización de venta de equipo; cuando el cliente autorice, el folio VTA aparece aquí."
          action={can(session.role, "quote.create", session.activeCompanyCode) ? <TextLink href="/ventas/nuevo">Nueva venta de equipo</TextLink> : undefined}
        />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead><tr><Th>Folio</Th><Th>Cliente</Th><Th>Cotización</Th><Th>Pendiente</Th></tr></thead>
              <tbody>
                {sales.map((sale) => {
                  const pendingReceive = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtySold - line.qtyReceived), 0);
                  const pendingDeliver = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtyReceived - line.qtyDelivered), 0);
                  const pending = pendingReceive > 0 ? `Recibir ${pendingReceive}` : pendingDeliver > 0 ? `Entregar ${pendingDeliver}` : "Al día";
                  return (
                    <tr key={sale.id}>
                      <Td><RecordLink href={`/ventas/${sale.id}`}>{sale.folio}</RecordLink></Td>
                      <Td><ClientNameLink clientId={sale.client.id} name={sale.client.name} isSystem={sale.client.isSystem} canEdit={canEditClient} /></Td>
                      <Td><TextLink href={`/cotizaciones/${sale.quoteId}`}>{sale.quote.folio}</TextLink></Td>
                      <Td><Badge>{pending}</Badge></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={sales.map((sale) => {
            const pendingReceive = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtySold - line.qtyReceived), 0);
            const pendingDeliver = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtyReceived - line.qtyDelivered), 0);
            const pending = pendingReceive > 0 ? `Recibir ${pendingReceive}` : pendingDeliver > 0 ? `Entregar ${pendingDeliver}` : "Al día";
            return (
              <MobileCard
                key={sale.id}
                href={`/ventas/${sale.id}`}
                title={sale.folio}
                meta={<Badge>{pending}</Badge>}
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
