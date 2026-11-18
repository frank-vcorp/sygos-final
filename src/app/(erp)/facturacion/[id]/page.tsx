import { notFound, redirect } from "next/navigation";
import { issueDocumentAction, retryFiscalAction } from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { ClientNameLink } from "@/components/client-entity-links";
import { IssueBillingDocumentForm } from "@/components/issue-billing-document-form";
import { Badge, Button, Card, EntityDetailHeader, EntityMetaItem, Table, Td, TextLink, Th } from "@/components/ui";
import { fiscalBadgeInfo } from "@/lib/billing-badges";
import { loadBillingDocumentServiceLinksForDocument } from "@/lib/billing-document-service-links";
import { cfdiUseLabel } from "@/lib/sat-cfdi-use";
import { resolveClientSatLegalName } from "@/lib/sat-legal-name";
import { paymentFormLabel, paymentMethodLabel } from "@/lib/sat-payment-method";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

const KIND_LABEL: Record<string, string> = {
  FACTURA: "Factura",
  REMISION: "Remisión",
  FACTURA_LIBRE: "Factura libre",
  FACTURA_INTERCOMPANIA: "Factura a SYSTRON",
};

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "invoice.request", session.activeCompanyCode) && !can(session.role, "invoice.issue", session.activeCompanyCode)) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.billingDocument.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: { client: true, quote: { select: { id: true, folio: true, technicalCaseId: true } }, receivable: true, lines: true },
  });
  if (!row) notFound();
  await redirectIfSalesNotAssigned(session, row.client.ownerUserId, "/facturacion");
  const serviceLinks = await loadBillingDocumentServiceLinksForDocument(row, session.activeCompanyId);
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const canIssue = can(session.role, "invoice.issue", session.activeCompanyCode);
  const history = await historyFor("DOCUMENTO", row.id);
  const statusLabel = row.status === "SOLICITADA" ? "Solicitada" : row.status === "EMITIDA" ? "Emitida" : row.status;
  const fiscalBadge = fiscalBadgeInfo(row);

  const defaultCfdiUse = row.cfdiUseSnapshot ?? row.client.cfdiUse ?? "";
  const defaultPaymentMethod = row.paymentMethodSnapshot ?? row.client.paymentMethod ?? "";
  const defaultPaymentForm = row.paymentFormSnapshot ?? (defaultPaymentMethod === "PPD" ? "99" : "03");
  const showFiscalFields = row.kind !== "REMISION";
  const canRetry =
    row.status === "EMITIDA"
    && canIssue
    && showFiscalFields
    && (row.fiscalStatus === "ERROR" || row.fiscalStatus === "PENDIENTE" || row.fiscalStatus === "PROCESANDO");

  let primaryAction: React.ReactNode = null;
  if (row.status === "SOLICITADA" && canIssue) {
    if (showFiscalFields) {
      primaryAction = (
        <IssueBillingDocumentForm
          documentId={row.id}
          action={issueDocumentAction}
          submitLabel="Emitir factura"
          cfdiUse={defaultCfdiUse}
          paymentMethod={defaultPaymentMethod}
          paymentForm={defaultPaymentForm}
        />
      );
    } else {
      primaryAction = (
        <form action={issueDocumentAction} className="inline">
          <input type="hidden" name="documentId" value={row.id} />
          <Button type="submit">Emitir remisión</Button>
        </form>
      );
    }
  } else if (canRetry) {
    primaryAction = (
      <IssueBillingDocumentForm
        documentId={row.id}
        action={retryFiscalAction}
        submitLabel={row.fiscalStatus === "PROCESANDO" ? "Consultar estatus" : "Reintentar timbrado"}
        cfdiUse={defaultCfdiUse}
        paymentMethod={defaultPaymentMethod}
        paymentForm={defaultPaymentForm}
        buttonTone="ghost"
      />
    );
  }

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/facturacion", label: "Facturación" }}
        title={row.folio}
        subtitle={KIND_LABEL[row.kind] ?? row.kind}
        status={
          <span className="flex flex-wrap gap-1.5">
            <Badge tone={row.status === "SOLICITADA" ? "warn" : "neutral"}>{statusLabel}</Badge>
            {fiscalBadge ? <Badge tone={fiscalBadge.tone}>{fiscalBadge.label}</Badge> : null}
          </span>
        }
        meta={
          <>
            <EntityMetaItem label="Cliente">
              <ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />
            </EntityMetaItem>
            <EntityMetaItem label="Total">{money(row.total)}</EntityMetaItem>
            {row.quote ? (
              <EntityMetaItem label="Cotización">
                <TextLink href={`/cotizaciones/${row.quote.id}`}>{row.quote.folio}</TextLink>
              </EntityMetaItem>
            ) : null}
            {serviceLinks.diagnosisFolio ? (
              <EntityMetaItem label="DX">
                {serviceLinks.diagnosisHref ? (
                  <TextLink href={serviceLinks.diagnosisHref}>{serviceLinks.diagnosisFolio}</TextLink>
                ) : (
                  serviceLinks.diagnosisFolio
                )}
              </EntityMetaItem>
            ) : null}
            {serviceLinks.osFolio && serviceLinks.osHref ? (
              <EntityMetaItem label="OS">
                <TextLink href={serviceLinks.osHref}>{serviceLinks.osFolio}</TextLink>
              </EntityMetaItem>
            ) : null}
            {row.issuedAt ? (
              <EntityMetaItem label="Emisión">{formatWhen(row.issuedAt)}</EntityMetaItem>
            ) : null}
            {row.dueAt ? <EntityMetaItem label="Vence">{formatWhen(row.dueAt)}</EntityMetaItem> : null}
            {row.receivable ? (
              <EntityMetaItem label="CxC">
                <TextLink href={`/cobranza/${row.receivable.id}`}>{money(row.receivable.balance)}</TextLink>
              </EntityMetaItem>
            ) : null}
          </>
        }
        primaryAction={primaryAction}
      />

      {row.fiscalEnv === "TEST" && row.fiscalStatus === "TIMBRADA" ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
          TIMBRE DE PRUEBA (SANDBOX): Este comprobante se timbró con una llave sk_test_ de Facturapi y no tiene validez fiscal ante el SAT.
        </div>
      ) : null}

      <Card className="p-4 text-sm space-y-2">
        {showFiscalFields ? (
          <div className="grid gap-1 sm:grid-cols-2">
            <p><span className="text-[var(--muted)]">Razón social SAT:</span> {resolveClientSatLegalName(row.client)}</p>
            <p><span className="text-[var(--muted)]">RFC:</span> {row.rfcSnapshot || row.client.rfc || "Sin definir"}</p>
            <p><span className="text-[var(--muted)]">Uso CFDI:</span> {cfdiUseLabel(row.cfdiUseSnapshot ?? row.client.cfdiUse)}</p>
            <p>
              <span className="text-[var(--muted)]">Método / Forma SAT:</span>{" "}
              {paymentMethodLabel(row.paymentMethodSnapshot ?? row.client.paymentMethod)}
              {row.paymentFormSnapshot ? ` · ${paymentFormLabel(row.paymentFormSnapshot)}` : ""}
            </p>
            {row.fiscalUuid ? (
              <p className="sm:col-span-2"><span className="text-[var(--muted)]">UUID Fiscal:</span> <code className="text-xs">{row.fiscalUuid}</code></p>
            ) : null}
            {row.fiscalSeries && row.fiscalFolioNumber ? (
              <p><span className="text-[var(--muted)]">Serie / Folio CFDI:</span> {row.fiscalSeries}-{row.fiscalFolioNumber}</p>
            ) : null}
          </div>
        ) : null}

        <p className="pt-1 font-medium">Subtotal {money(row.subtotal)} · IVA {money(row.iva)} · Total {money(row.total)}</p>

        {row.fiscalError ? <p className="mt-2 rounded-md bg-[var(--warn-soft)] px-3 py-2">{row.fiscalError}</p> : null}

        <div className="pt-3">
          <Table>
            <thead>
              <tr>
                <Th>Concepto</Th>
                <Th>Cant.</Th>
                <Th>P. Unit. neto</Th>
                <Th>Descuento</Th>
                <Th>Clave SAT</Th>
                <Th>Importe</Th>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((line) => (
                <tr key={line.id}>
                  <Td>{line.concept}</Td>
                  <Td>{line.quantity}</Td>
                  <Td>{money(line.unitPrice)}</Td>
                  <Td>{line.discountAmount > 0 ? money(line.discountAmount) : "—"}</Td>
                  <Td className="text-xs text-[var(--muted)]">
                    {line.satProductKey || "—"} · {line.satUnitKey || "E48"} · Obj {line.taxability || "02"}
                  </Td>
                  <Td>{money(line.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
