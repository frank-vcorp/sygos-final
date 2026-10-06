import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { prisma } from "@/lib/db";
import { linesForTotal, money, quoteTotals } from "@/lib/money";
import { requireCompany } from "@/lib/session";

export default async function CotizacionDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const quote = await prisma.quote.findFirst({ where: { id, companyId: session.activeCompanyId }, include: { client: true, company: true, lines: true } });
  if (!quote) notFound();
  const totals = quoteTotals(linesForTotal(quote.lines, quote.quoteType, quote.status), quote.discountPct);
  return (
    <article className="mx-auto max-w-3xl bg-white p-8 text-sm print:p-0">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <p className="text-lg font-semibold">{quote.company.legalName || quote.company.name}</p>
          <p>{quote.company.rfc || "RFC pendiente"}</p>
          <p>{quote.company.fiscalAddress}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{quote.folio}</p>
          <p>{quote.status}</p>
        </div>
      </header>
      <p className="mt-4">Cliente: {quote.client.name}</p>
      <table className="mt-4 w-full">
        <thead><tr className="border-b text-left"><th>Concepto</th><th>Cantidad</th><th>Importe</th></tr></thead>
        <tbody>
          {quote.lines.map((line) => <tr key={line.id} className="border-b"><td className="py-2">{line.concept}</td><td>{line.quantity}</td><td>{money((line.unitPrice ?? 0) * line.quantity)}</td></tr>)}
        </tbody>
      </table>
      <p className="mt-4 text-right text-base font-medium">Total {money(totals?.total)}</p>
      <PrintButton />
    </article>
  );
}
