import { DocumentFooter } from "@/components/documents/document-footer";
import { DocumentHeader } from "@/components/documents/document-header";
import { DocumentLegalNotes } from "@/components/documents/document-legal-notes";
import { DocumentLinesTableCommercial } from "@/components/documents/document-lines-table";
import { DocumentPartyGrid, buildCommercialClientParty } from "@/components/documents/document-party-grid";
import { DocumentPrintShell } from "@/components/documents/document-print-shell";
import { DocumentTotalsBox } from "@/components/documents/document-totals-box";
import { billingDocumentIssuedLabel, billingMetaRefs, loadBillingDocumentForPrint } from "@/lib/billing-document-print";
import { companyDisplayName, primaryContact } from "@/lib/document-print";
import { money } from "@/lib/money";
import { quotePaymentConditionDisplay, warrantyMonthsLabel } from "@/lib/quote-commercial-terms";

export default async function RemisionDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { row, serviceLinks } = await loadBillingDocumentForPrint(id, { kind: "REMISION" });
  const issued = billingDocumentIssuedLabel(row);
  const contact = primaryContact(row.client.contacts);
  const clientParty = buildCommercialClientParty(row.client, contact);
  const refs = billingMetaRefs(row, serviceLinks);
  const discountTotal = row.lines.reduce((sum, line) => sum + line.discountAmount, 0);

  return (
    <DocumentPrintShell companyCode={row.company.code} backHref={`/facturacion/${row.id}`} backLabel="Volver a facturación">
      <DocumentHeader company={row.company} docTitle="Remisión" folio={row.folio} issued={issued} />

      <div className="px-6 py-6 sm:px-10">
        <DocumentPartyGrid
          clientName={clientParty.clientName}
          clientLines={clientParty.clientLines}
          right={
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Referencias</p>
              {refs.length ? (
                <p className="mt-1 text-sm text-[var(--muted)]">{refs.join(" · ")}</p>
              ) : (
                <p className="mt-1 text-sm text-[var(--muted)]">{row.concept}</p>
              )}
            </>
          }
        />

        <DocumentLinesTableCommercial
          lines={row.lines.map((line) => ({
            id: line.id,
            concept: line.concept,
            quantity: line.quantity,
            unitPrice: money(line.unitPrice),
            amount: money(line.amount),
          }))}
        />

        <DocumentTotalsBox
          rows={[
            { key: "sub", label: "Subtotal", value: money(row.subtotal) },
            ...(discountTotal > 0 ? [{ key: "disc", label: "Descuento", value: `− ${money(discountTotal)}` }] : []),
            { key: "iva", label: "IVA 16%", value: money(row.iva) },
            { key: "tot", label: "Total", value: money(row.total), emphasis: true },
          ]}
        />

        <DocumentLegalNotes>
          {row.quote && warrantyMonthsLabel(row.quote.warrantyMonths) ? (
            <p>Garantía: {warrantyMonthsLabel(row.quote.warrantyMonths)}.</p>
          ) : null}
          {row.quote ? (
            <p>
              Condición de pago: {quotePaymentConditionDisplay(row.quote.paymentCondition, row.quote.creditDays ?? row.creditDays)}.
            </p>
          ) : row.creditDays > 0 ? (
            <p>Condición de pago: Crédito ({row.creditDays} días).</p>
          ) : (
            <p>Condición de pago: Contado.</p>
          )}
          {row.quote?.reference ? <p className="whitespace-pre-wrap">Referencia: {row.quote.reference}</p> : null}
          <p>Importes expresados en pesos mexicanos (MXN).</p>
          <p className="font-medium text-[var(--ink)]">
            Este documento es una remisión de entrega y no sustituye el comprobante fiscal (factura).
          </p>
        </DocumentLegalNotes>

        <DocumentFooter issuerName={companyDisplayName(row.company)} folio={row.folio} />
      </div>
    </DocumentPrintShell>
  );
}