import { notFound, redirect } from "next/navigation";
import { deliverSaleAction, receiveSaleAction } from "./actions";
import { ClientNameLink } from "@/components/client-entity-links";
import { Button, DetailAnchorButton, EntityDetailHeader, EntityMetaItem, TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export default async function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const sale = await prisma.sale.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { lines: true, quote: true, client: true },
  });
  if (!sale) notFound();
  await redirectIfSalesNotAssigned(session, sale.quote.sellerUserId, "/ventas");
  const canMove = can(session.role, "sale.receive", session.activeCompanyCode);
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const pendingReceive = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtySold - line.qtyReceived), 0);
  const pendingDeliver = sale.lines.reduce((sum, line) => sum + Math.max(0, line.qtyReceived - line.qtyDelivered), 0);
  const movementHint =
    pendingReceive > 0 ? `${pendingReceive} por recibir en almacén` : pendingDeliver > 0 ? `${pendingDeliver} por entregar` : "Mercancía surtida";

  return (
    <>
      <EntityDetailHeader
        back={canMove && session.role === "ALMACEN" ? { href: "/custodia", label: "Almacén" } : { href: "/ventas", label: "Venta de equipos" }}
        title={sale.folio}
        subtitle="Venta de equipos · sin entrada a inventario de refacciones"
        meta={
          <>
            <EntityMetaItem label="Cliente">
              <ClientNameLink clientId={sale.client.id} name={sale.client.name} isSystem={sale.client.isSystem} canEdit={canEditClient} />
            </EntityMetaItem>
            <EntityMetaItem label="Cotización">
              <TextLink href={`/cotizaciones/${sale.quoteId}`}>{sale.quote.folio}</TextLink>
            </EntityMetaItem>
            <EntityMetaItem label="Movimiento">{movementHint}</EntityMetaItem>
          </>
        }
        primaryAction={canMove && (pendingReceive > 0 || pendingDeliver > 0) ? <DetailAnchorButton href="#lineas-venta">Registrar recepción o entrega</DetailAnchorButton> : null}
      />
      <ul id="lineas-venta" className="scroll-mt-24 space-y-3">
        {sale.lines.map((line) => (
          <li key={line.id} className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
            <p className="font-medium">{line.concept}</p>
            <p className="mt-1">Vendido {line.qtySold} · recibido {line.qtyReceived} · entregado {line.qtyDelivered} · pendiente {line.qtySold - line.qtyDelivered}</p>
            {canMove ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <form action={receiveSaleAction} className="flex gap-1">
                  <input type="hidden" name="lineId" value={line.id} />
                  <input type="hidden" name="saleId" value={sale.id} />
                  <input name="quantity" type="number" min={1} required className="w-16 rounded-md border border-[var(--line)] px-2 py-1" />
                  <Button type="submit" tone="ghost">Recibir</Button>
                </form>
                <form action={deliverSaleAction} className="flex gap-1">
                  <input type="hidden" name="lineId" value={line.id} />
                  <input type="hidden" name="saleId" value={sale.id} />
                  <input name="quantity" type="number" min={1} required className="w-16 rounded-md border border-[var(--line)] px-2 py-1" />
                  <Button type="submit" tone="ghost">Entregar</Button>
                </form>
              </div>
            ) : <p className="mt-2 text-[var(--muted)]">Recepción y entrega las registra almacén.</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
