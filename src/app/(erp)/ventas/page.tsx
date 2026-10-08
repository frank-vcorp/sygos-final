import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientNameLink } from "@/components/client-entity-links";
import { Badge, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
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
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader
        title="Venta de equipos"
        subtitle="Ventas autorizadas de tu cartera. Recepción y entrega se confirman en el detalle."
        back={session.role === "VENTAS" ? { href: "/panel", label: "Inicio" } : undefined}
      />
      {sales.length === 0 ? (
        <Empty title="Sin ventas de equipo" body="Aparecen aquí cuando una cotización de venta de equipo queda autorizada." />
      ) : (
        <Table>
          <thead><tr><Th>Folio</Th><Th>Cliente</Th><Th>Cotización</Th><Th>Pendiente</Th></tr></thead>
          <tbody>
            {sales.map((sale) => {
              const pendingReceive = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtySold - line.qtyReceived), 0);
              const pendingDeliver = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtyReceived - line.qtyDelivered), 0);
              const pending = pendingReceive > 0 ? `Recibir ${pendingReceive}` : pendingDeliver > 0 ? `Entregar ${pendingDeliver}` : "Al día";
              return (
                <tr key={sale.id}>
                  <Td><Link href={`/ventas/${sale.id}`} className="font-medium text-[var(--accent)]">{sale.folio}</Link></Td>
                  <Td><ClientNameLink clientId={sale.client.id} name={sale.client.name} isSystem={sale.client.isSystem} canEdit={canEditClient} /></Td>
                  <Td><Link href={`/cotizaciones/${sale.quoteId}`} className="text-[var(--accent)]">{sale.quote.folio}</Link></Td>
                  <Td><Badge>{pending}</Badge></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
