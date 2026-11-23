import { notFound } from "next/navigation";
import { DocumentFooter } from "@/components/documents/document-footer";
import { DocumentHeader } from "@/components/documents/document-header";
import { DocumentLegalNotes } from "@/components/documents/document-legal-notes";
import { DocumentLinesTableCommercial } from "@/components/documents/document-lines-table";
import { DocumentPartyGrid, buildCommercialClientParty } from "@/components/documents/document-party-grid";
import { DocumentPrintShell } from "@/components/documents/document-print-shell";
import { DocumentTotalsBox } from "@/components/documents/document-totals-box";
import { QuoteConcept } from "@/components/quote-concept";
import { prisma } from "@/lib/db";
import { companyDisplayName, primaryContact } from "@/lib/document-print";
import { linesForTotal, money, quoteTotals } from "@/lib/money";
import { quotePaymentConditionDisplay, warrantyMonthsLabel } from "@/lib/quote-commercial-terms";
import { quoteLineConditionLabel } from "@/lib/quote-line-condition";
import { QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, quoteRequiresDeliveryDays, quoteShowsSellerDeliveryDays, type QuoteType } from "@/lib/quotes";
import { requireCompany } from "@/lib/session";

export default async function CotizacionDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  const { id } = await params;
  const quote = await prisma.quote.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: {
      client: { include: { contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } },
      company: true,
      lines: true,
    },
  });
  if (!quote) notFound();
  const lines = linesForTotal(quote.lines, quote.quoteType, quote.status);
  const totals = quoteTotals(lines, quote.discountPct);
  const seller = quote.sellerUserId ? await prisma.user.findUnique({ where: { id: quote.sellerUserId }, select: { name: true } }) : null;
  const issued = quote.createdAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" });
  const contact = primaryContact(quote.client.contacts);
  const clientParty = buildCommercialClientParty(quote.client, contact);

  return (
    <DocumentPrintShell companyCode={quote.company.code} backHref={`/cotizaciones/${quote.id}`} backLabel="Volver a la cotización">
      <DocumentHeader
        company={quote.company}
        docTitle="Cotización"
        folio={quote.folio}
        issued={issued}
        statusBadge={{ label: QUOTE_STATUS_LABEL[quote.status] ?? quote.status }}
      />

      <div className="px-6 py-6 sm:px-10">
        <DocumentPartyGrid
          clientName={clientParty.clientName}
          clientLines={clientParty.clientLines}
          right={
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Servicio</p>
              <p className="mt-1 font-medium">{QUOTE_TYPE_LABEL[quote.quoteType as QuoteType] ?? quote.quoteType}</p>
              {seller ? <p className="text-sm text-[var(--muted)]">Atiende: {seller.name}</p> : null}
            </>
          }
        />

        <DocumentLinesTableCommercial
          lines={lines.map((line, index) => {
            const condition = quoteLineConditionLabel(line.lineCondition);
            const conceptBody = condition && quote.quoteType === "VENTA_EQUIPO"
              ? `${line.concept} (${condition})`
              : line.concept;
            return {
              id: line.id,
              concept: <QuoteConcept concept={conceptBody} complement={index === 0 ? quote.sellerConceptComplement : null} />,
              quantity: line.quantity,
              unitPrice: money(line.unitPrice),
              amount: line.unitPrice == null ? "Pendiente" : money(line.unitPrice * line.quantity),
            };
          })}
        />

        <DocumentTotalsBox
          rows={
            totals
              ? [
                  { key: "sub", label: "Subtotal", value: money(totals.subtotal) },
                  ...(totals.discount > 0
                    ? [{ key: "disc", label: `Descuento (${quote.discountPct}%)`, value: `− ${money(totals.discount)}` }]
                    : []),
                  { key: "iva", label: "IVA 16%", value: money(totals.iva) },
                  { key: "tot", label: "Total", value: money(totals.total), emphasis: true },
                ]
              : []
          }
          emptyFallback={<div className="w-[280px] font-medium text-[var(--warn)]">Cotización pendiente de precio.</div>}
        />

        <DocumentLegalNotes>
          {warrantyMonthsLabel(quote.warrantyMonths) ? <p>Garantía: {warrantyMonthsLabel(quote.warrantyMonths)}.</p> : null}
          <p>Condición de pago: {quotePaymentConditionDisplay(quote.paymentCondition, quote.creditDays)}.</p>
          {quote.reference ? <p className="whitespace-pre-wrap">Referencia: {quote.reference}</p> : null}
          {quoteShowsSellerDeliveryDays(quote) || (quoteRequiresDeliveryDays(quote) && quote.deliveryBusinessDays != null) ? (
            <p>Tiempo de entrega: {quote.deliveryBusinessDays} días hábiles.</p>
          ) : null}
          {quote.quoteType === "CAMPO" && (quote.preliminaryBrand || quote.preliminaryModel) ? (
            <p>
              Equipo: {[quote.preliminaryBrand, quote.preliminaryModel, quote.preliminarySerial ? `S/N ${quote.preliminarySerial}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          {quoteRequiresDeliveryDays(quote) && quote.slaDueAt ? (
            <p>
              Fecha de entrega:{" "}
              {quote.slaDueAt.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "long" })}.
            </p>
          ) : null}
          <p>Importes expresados en pesos mexicanos (MXN).</p>
        </DocumentLegalNotes>

        <DocumentFooter issuerName={companyDisplayName(quote.company)} folio={quote.folio} />
      </div>
    </DocumentPrintShell>
  );
}