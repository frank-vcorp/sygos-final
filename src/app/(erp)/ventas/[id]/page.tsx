import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deliverSaleAction, receiveSaleAction } from "./actions";
import { Button, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function VentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const sale = await prisma.sale.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { lines: true, quote: true, client: true },
  });
  if (!sale) notFound();
  if (session.role === "VENTAS" && sale.quote.sellerUserId !== session.userId) redirect("/ventas");
  const canMove = can(session.role, "sale.receive", session.activeCompanyCode);
  return (
    <>
      <PageHeader title={sale.folio} subtitle={`Venta de ${sale.client.name}`} />
      <p className="mb-4 text-sm">Cotización <Link href={`/cotizaciones/${sale.quoteId}`} className="text-[var(--accent)]">{sale.quote.folio}</Link>. La mercancía no entra al inventario de refacciones. Factura y remisión llegan en la fase siguiente.</p>
      <ul className="space-y-3">
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
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
