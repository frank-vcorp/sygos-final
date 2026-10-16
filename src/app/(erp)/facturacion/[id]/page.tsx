import { notFound, redirect } from "next/navigation";
import { issueDocumentAction, retryFiscalAction } from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { ClientNameLink } from "@/components/client-entity-links";
import { IssueBillingDocumentForm } from "@/components/issue-billing-document-form";
import { Badge, Button, Card, EntityDetailHeader, EntityMetaItem, TextLink } from "@/components/ui";
import { cfdiUseLabel } from "@/lib/sat-cfdi-use";
import { paymentMethodLabel } from "@/lib/sat-payment-method";
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
    include: { client: true, quote: true, receivable: true, lines: true },
  });
  if (!row) notFound();
  await redirectIfSalesNotAssigned(session, row.client.ownerUserId, "/facturacion");
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const canIssue = can(session.role, "invoice.issue", session.activeCompanyCode);
  const history = await historyFor("DOCUMENTO", row.id);
  const statusLabel = row.status === "SOLICITADA" ? "Solicitada" : row.status === "EMITIDA" ? "Emitida" : row.status;

  const defaultCfdiUse = row.cfdiUseSnapshot ?? row.client.cfdiUse ?? "";
  const defaultPaymentMethod = row.paymentMethodSnapshot ?? row.client.paymentMethod ?? "";
  const showFiscalFields = row.kind !== "REMISION";

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
  } else if (row.fiscalStatus === "ERROR" && canIssue && showFiscalFields) {
    primaryAction = (
      <IssueBillingDocumentForm
        documentId={row.id}
        action={retryFiscalAction}
        submitLabel="Reintentar timbrado"
        cfdiUse={defaultCfdiUse}
        paymentMethod={defaultPaymentMethod}
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
        status={<Badge tone={row.status === "SOLICITADA" ? "warn" : "neutral"}>{statusLabel}</Badge>}
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
      <Card className="p-4 text-sm">
        {row.rfcSnapshot ? <p>RFC congelado: {row.rfcSnapshot}</p> : null}
        {row.cfdiUseSnapshot || row.paymentMethodSnapshot ? (
          <p className={row.rfcSnapshot ? "mt-1" : ""}>
            Uso CFDI: {cfdiUseLabel(row.cfdiUseSnapshot)} · Método de pago: {paymentMethodLabel(row.paymentMethodSnapshot)}
          </p>
        ) : null}
        <p className={row.rfcSnapshot || row.cfdiUseSnapshot ? "mt-1" : ""}>Subtotal {money(row.subtotal)} · IVA {money(row.iva)}</p>
        {row.fiscalError ? <p className="mt-3 rounded-md bg-[var(--warn-soft)] px-3 py-2">{row.fiscalError}</p> : null}
        <ul className="mt-3 space-y-1">{row.lines.map((line) => <li key={line.id}>{line.concept} · {money(line.amount)}</li>)}</ul>
      </Card>
      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
