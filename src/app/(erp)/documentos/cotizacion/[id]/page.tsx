import { notFound } from "next/navigation";
import { CompanyLogo } from "@/components/brand-logo";
import { PrintButton } from "@/components/print-button";
import { prisma } from "@/lib/db";
import { linesForTotal, money, quoteTotals } from "@/lib/money";
import { QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, type QuoteType } from "@/lib/quotes";
import { requireCompany } from "@/lib/session";

export default async function CotizacionDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const quote = await prisma.quote.findFirst({ where: { id, companyId: session.activeCompanyId }, include: { client: true, company: true, lines: true } });
  if (!quote) notFound();
  const lines = linesForTotal(quote.lines, quote.quoteType, quote.status);
  const totals = quoteTotals(lines, quote.discountPct);
  const seller = quote.sellerUserId ? await prisma.user.findUnique({ where: { id: quote.sellerUserId }, select: { name: true } }) : null;
  const issued = quote.createdAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" });
  return (
    <article className="quote-document mx-auto max-w-4xl overflow-hidden rounded-lg border border-[var(--line)] bg-white text-sm print:max-w-none print:rounded-none print:border-0">
      <header className="border-b-4 border-[var(--accent)] px-6 py-6 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <CompanyLogo code={quote.company.code} />
            <p className="mt-3 font-semibold">{quote.company.legalName || quote.company.name}</p>
            <p className="text-xs text-[var(--muted)]">RFC: {quote.company.rfc || "Pendiente"}</p>
            {quote.company.fiscalAddress ? <p className="max-w-md text-xs text-[var(--muted)]">{quote.company.fiscalAddress}</p> : null}
          </div>
          <div className="min-w-52 text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Cotización</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--accent)]">{quote.folio}</p>
            <p className="mt-1">{issued}</p>
            <p className="mt-2 inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</p>
          </div>
        </div>
      </header>

      <div className="px-6 py-6 sm:px-10">
        <section className="grid gap-4 rounded-lg bg-[#f7f8f9] p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Cliente</p>
            <p className="mt-1 text-base font-semibold">{quote.client.name}</p>
            {quote.client.rfc ? <p className="text-sm text-[var(--muted)]">RFC: {quote.client.rfc}</p> : null}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Servicio</p>
            <p className="mt-1 font-medium">{QUOTE_TYPE_LABEL[quote.quoteType as QuoteType] ?? quote.quoteType}</p>
            {seller ? <p className="text-sm text-[var(--muted)]">Atiende: {seller.name}</p> : null}
          </div>
        </section>

        <table className="mt-6 w-full text-left">
          <thead>
            <tr className="bg-[var(--accent)] text-white">
              <th className="px-3 py-2.5">Concepto</th>
              <th className="w-24 px-3 py-2.5 text-center">Cantidad</th>
              <th className="w-36 px-3 py-2.5 text-right">Precio unitario</th>
              <th className="w-36 px-3 py-2.5 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-[var(--line)]">
                <td className="px-3 py-3">{line.concept}</td>
                <td className="px-3 py-3 text-center">{line.quantity}</td>
                <td className="px-3 py-3 text-right">{money(line.unitPrice)}</td>
                <td className="px-3 py-3 text-right font-medium">{line.unitPrice == null ? "Pendiente" : money(line.unitPrice * line.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_280px]">
          <div className="text-sm">
            {quote.reference ? <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Información complementaria</p><p className="mt-1 whitespace-pre-wrap">{quote.reference}</p></div> : null}
            <p className="mt-4 text-[var(--muted)]">Condición de pago: {quote.creditDays && quote.creditDays > 0 ? `${quote.creditDays} días de crédito` : "Pago de contado"}.</p>
            <p className="mt-1 text-[var(--muted)]">Importes expresados en pesos mexicanos.</p>
          </div>
          <dl className="space-y-2 rounded-lg border border-[var(--line)] p-4">
            {totals ? (
              <>
                <div className="flex justify-between gap-4"><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
                {totals.discount > 0 ? <div className="flex justify-between gap-4"><dt>Descuento ({quote.discountPct}%)</dt><dd>− {money(totals.discount)}</dd></div> : null}
                <div className="flex justify-between gap-4"><dt>IVA 16%</dt><dd>{money(totals.iva)}</dd></div>
                <div className="flex justify-between gap-4 border-t border-[var(--line)] pt-3 text-lg font-semibold text-[var(--accent)]"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
              </>
            ) : <div className="font-medium text-[var(--warn)]">Cotización pendiente de precio.</div>}
          </dl>
        </div>

        <footer className="mt-10 border-t border-[var(--line)] pt-4 text-center text-xs text-[var(--muted)]">
          Documento emitido por {quote.company.legalName || quote.company.name} · {quote.folio}
        </footer>
        <PrintButton />
      </div>
    </article>
  );
}
