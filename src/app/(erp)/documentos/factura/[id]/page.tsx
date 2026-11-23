import { notFound } from "next/navigation";
import { DocumentFooter } from "@/components/documents/document-footer";
import { DocumentHeader } from "@/components/documents/document-header";
import { DocumentLegalNotes } from "@/components/documents/document-legal-notes";
import { DocumentLinesTableFiscal } from "@/components/documents/document-lines-table";
import { DocumentPartyGrid, buildFiscalClientParty } from "@/components/documents/document-party-grid";
import { DocumentPrintShell } from "@/components/documents/document-print-shell";
import { DocumentTotalsBox } from "@/components/documents/document-totals-box";
import { TextLink } from "@/components/ui";
import { billingDocumentIssuedLabel, billingMetaRefs, loadBillingDocumentForPrint } from "@/lib/billing-document-print";
import { companyDisplayName, primaryContact } from "@/lib/document-print";
import { money } from "@/lib/money";
import { cfdiUseLabel } from "@/lib/sat-cfdi-use";
import { resolveClientSatLegalName } from "@/lib/sat-legal-name";
import { paymentFormLabel, paymentMethodLabel } from "@/lib/sat-payment-method";
import { quotePaymentConditionDisplay, warrantyMonthsLabel } from "@/lib/quote-commercial-terms";

const FACTURA_KINDS = new Set(["FACTURA", "FACTURA_LIBRE", "FACTURA_INTERCOMPANIA"]);

export default async function FacturaDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { row, serviceLinks } = await loadBillingDocumentForPrint(id);
  if (!FACTURA_KINDS.has(row.kind)) notFound();

  const issued = billingDocumentIssuedLabel(row);
  const contact = primaryContact(row.client.contacts);
  const clientParty = buildFiscalClientParty(
    {
      name: row.client.name,
      satLegalName: resolveClientSatLegalName(row.client),
      rfc: row.rfcSnapshot || row.client.rfc,
      taxRegime: row.client.taxRegime,
      fiscalAddress: row.client.fiscalAddress,
      fiscalZip: row.client.fiscalZip,
      cfdiUse: cfdiUseLabel(row.cfdiUseSnapshot ?? row.client.cfdiUse),
      paymentMethod: paymentMethodLabel(row.paymentMethodSnapshot ?? row.client.paymentMethod),
      paymentForm: row.paymentFormSnapshot ? paymentFormLabel(row.paymentFormSnapshot) : null,
    },
    contact,
  );
  const refs = billingMetaRefs(row, serviceLinks);
  const discountTotal = row.lines.reduce((sum, line) => sum + line.discountAmount, 0);
  const timbrada = row.fiscalStatus === "TIMBRADA" || row.fiscalStatus === "SIMULADA";
  const sinValidez = row.status === "SOLICITADA" || !timbrada;

  return (
    <DocumentPrintShell companyCode={row.company.code} backHref={`/facturacion/${row.id}`} backLabel="Volver a facturación">
      {timbrada ? (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-950 print:hidden sm:px-10">
          <p className="font-medium">Comprobante fiscal timbrado</p>
          <p className="text-xs text-amber-900">
            El PDF oficial con validez ante el SAT es el de Facturapi. Esta vista es copia interna / prefactura SYGOS.
          </p>
          <TextLink href={`/api/billing/documents/${row.id}/pdf`} className="mt-1 inline-block text-xs font-semibold">
            Ver PDF oficial timbrado
          </TextLink>
        </div>
      ) : null}

      <DocumentHeader
        company={row.company}
        docTitle="Factura"
        folio={row.folio}
        issued={issued}
        statusBadge={
          row.status === "SOLICITADA"
            ? { label: "Solicitada", className: "mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900" }
            : null
        }
      />

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
              {row.fiscalUuid ? (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  UUID {row.fiscalUuid}
                  {row.fiscalSeries && row.fiscalFolioNumber ? ` · ${row.fiscalSeries}-${row.fiscalFolioNumber}` : ""}
                </p>
              ) : null}
            </>
          }
        />

        <DocumentLinesTableFiscal
          lines={row.lines.map((line) => ({
            id: line.id,
            concept: line.concept,
            quantity: line.quantity,
            unitPrice: money(line.unitPrice),
            discount: line.discountAmount > 0 ? money(line.discountAmount) : "—",
            satDetail: `${line.satProductKey || "—"} · ${line.satUnitKey || "E48"} · Obj ${line.taxability || "02"}`,
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

        <DocumentLegalNotes title="Datos fiscales y condiciones">
          {sinValidez ? (
            <p className="font-semibold text-[var(--ink)]">Documento sin validez fiscal ante el SAT (prefactura / copia SYGOS).</p>
          ) : (
            <p>Copia de referencia SYGOS del comprobante timbrado; validez legal en el PDF/XML oficial.</p>
          )}
          {row.quote && warrantyMonthsLabel(row.quote.warrantyMonths) ? (
            <p>Garantía: {warrantyMonthsLabel(row.quote.warrantyMonths)}.</p>
          ) : null}
          {row.quote ? (
            <p>
              Condición de pago: {quotePaymentConditionDisplay(row.quote.paymentCondition, row.quote.creditDays ?? row.creditDays)}.
            </p>
          ) : row.creditDays > 0 ? (
            <p>Condición de pago: Crédito ({row.creditDays} días).</p>
          ) : null}
          {row.quote?.reference ? <p className="whitespace-pre-wrap">Referencia: {row.quote.reference}</p> : null}
          <p>Importes expresados en pesos mexicanos (MXN).</p>
        </DocumentLegalNotes>

        <DocumentFooter
          issuerName={companyDisplayName(row.company)}
          folio={row.folio}
          extra={timbrada && row.fiscalUuid ? `UUID ${row.fiscalUuid}` : null}
        />
      </div>
    </DocumentPrintShell>
  );
}