import { notFound, redirect } from "next/navigation";
import {
  authorizeAndExecuteCancelAction,
  authorizeCancelDocumentAction,
  executeCancelDocumentAction,
  issueCreditNoteAction,
  issueDocumentAction,
  pollCancelStatusAction,
  requestCancelDocumentAction,
  retryFiscalAction,
  sendBillingEmailAction,
  sendBillingWhatsAppAction,
  updateBillingLineSatAction,
} from "../actions";
import { BillingLineSatEditor } from "@/components/billing-line-sat-editor";
import { CfdiUseSelect } from "@/components/cfdi-use-select";
import { HistoryTimeline } from "@/components/history-timeline";
import { ClientNameLink } from "@/components/client-entity-links";
import { IssueBillingDocumentForm } from "@/components/issue-billing-document-form";
import { PaymentFormSelect } from "@/components/payment-form-select";
import { Badge, Button, Card, controlClass, EntityDetailHeader, EntityMetaItem, MoneyInput, Table, Td, TextLink, Th } from "@/components/ui";
import { fiscalBadgeInfo, repBadgeInfo } from "@/lib/billing-badges";
import {
  resolveBillingDocumentEmailRecipient,
  resolveBillingDocumentWhatsAppPhone,
} from "@/lib/billing-delivery";
import { loadBillingDocumentServiceLinksForDocument } from "@/lib/billing-document-service-links";
import { SAT_CANCEL_MOTIVES } from "@/lib/facturapi";
import { cfdiUseLabel } from "@/lib/sat-cfdi-use";
import { resolveClientSatLegalName } from "@/lib/sat-legal-name";
import { paymentFormLabel, paymentMethodLabel } from "@/lib/sat-payment-method";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { money } from "@/lib/money";
import { billingLineSatKeysEditable } from "@/lib/billing-line-sat";
import { can } from "@/lib/permissions";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

const KIND_LABEL: Record<string, string> = {
  FACTURA: "Factura",
  REMISION: "Remisión",
  FACTURA_LIBRE: "Factura libre",
  FACTURA_INTERCOMPANIA: "Factura a SYSTRON",
  NOTA_CREDITO: "Nota de crédito",
};

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "invoice.request", session.activeCompanyCode) && !can(session.role, "invoice.issue", session.activeCompanyCode)) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.billingDocument.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: {
      client: {
        include: {
          contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        },
      },
      quote: { select: { id: true, folio: true, technicalCaseId: true } },
      receivable: {
        include: {
          applications: {
            where: { confirmedAt: { not: null } },
            include: {
              payment: {
                select: {
                  id: true,
                  folio: true,
                  amount: true,
                  paymentComplement: {
                    select: {
                      id: true,
                      fiscalStatus: true,
                      fiscalEnv: true,
                      fiscalUuid: true,
                      fiscalExternalId: true,
                      xmlContent: true,
                      pdfContent: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      paymentComplementItems: {
        include: {
          complement: {
            include: {
              payment: { select: { id: true, folio: true } },
            },
          },
        },
        orderBy: { installment: "asc" },
      },
      relatedDocument: { select: { id: true, folio: true, fiscalUuid: true } },
      substitutionDocument: { select: { id: true, folio: true } },
      creditNotes: { orderBy: { createdAt: "desc" } },
      lines: true,
    },
  });
  if (!row) notFound();
  await redirectIfSalesNotAssigned(session, row.client.ownerUserId, "/facturacion");
  const serviceLinks = await loadBillingDocumentServiceLinksForDocument(row, session.activeCompanyId);
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const canIssue = can(session.role, "invoice.issue", session.activeCompanyCode);
  const canAuthorizeCancel = session.role === "CEO" || session.role === "ADMINISTRADOR";
  const canRequestCancel =
    can(session.role, "invoice.request", session.activeCompanyCode) || canIssue;
  const history = await historyFor("DOCUMENTO", row.id);
  const statusLabel = row.status === "SOLICITADA" ? "Solicitada" : row.status === "EMITIDA" ? "Emitida" : row.status === "CANCELADA" ? "Cancelada" : row.status;
  const fiscalBadge = fiscalBadgeInfo(row);

  const substitutionCandidates =
    row.status !== "CANCELADA" && canRequestCancel
      ? await prisma.billingDocument.findMany({
          where: {
            companyId: session.activeCompanyId,
            id: { not: row.id },
            status: "EMITIDA",
            kind: { notIn: ["REMISION", "NOTA_CREDITO"] },
            fiscalStatus: { in: ["TIMBRADA", "SIMULADA"] },
          },
          select: { id: true, folio: true, total: true, fiscalUuid: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];

  const alreadyCredited = row.creditNotes
    .filter((nc) => nc.status !== "CANCELADA")
    .reduce((sum, nc) => sum + nc.total, 0);
  const maxCreditable = Math.max(0, Math.round((row.total - alreadyCredited) * 100) / 100);
  const isCancelPendingSat = row.cancellationStatus === "pending" || row.cancellationStatus === "verifying";
  const hasActiveRep = row.paymentComplementItems.some((item) => item.complement.fiscalStatus !== "CANCELADA");
  const canShowCancelReceipt =
    Boolean(row.cancelReceiptXml)
    || Boolean(row.cancelReceiptPdf)
    || (Boolean(row.fiscalExternalId)
      && (row.status === "CANCELADA" || row.cancellationStatus === "pending" || row.cancellationStatus === "verifying"));

  const defaultCfdiUse = row.cfdiUseSnapshot ?? row.client.cfdiUse ?? "";
  const defaultPaymentMethod = row.paymentMethodSnapshot ?? row.client.paymentMethod ?? "";
  const defaultPaymentForm = row.paymentFormSnapshot ?? (defaultPaymentMethod === "PPD" ? "99" : "03");
  const showFiscalFields = row.kind !== "REMISION";
  const canRetry =
    row.status === "EMITIDA"
    && canIssue
    && showFiscalFields
    && (row.fiscalStatus === "ERROR" || row.fiscalStatus === "PENDIENTE" || row.fiscalStatus === "PROCESANDO");
  const canEditSatLines =
    showFiscalFields
    && billingLineSatKeysEditable(row)
    && (canIssue || can(session.role, "invoice.request", session.activeCompanyCode));

  const canDownloadAndDeliver =
    showFiscalFields
    && (row.fiscalStatus === "TIMBRADA"
      || Boolean(row.xmlContent)
      || Boolean(row.pdfContent)
      || (Boolean(row.fiscalExternalId) && row.fiscalStatus === "CANCELADA"));
  const defaultEmail = resolveBillingDocumentEmailRecipient(row) ?? "";
  const defaultPhone = resolveBillingDocumentWhatsAppPhone(row) ?? "";

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
            {row.relatedDocument ? (
              <EntityMetaItem label="Factura origen">
                <TextLink href={`/facturacion/${row.relatedDocument.id}`}>{row.relatedDocument.folio}</TextLink>
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
        secondaryActions={
          row.kind === "REMISION" ? (
            <TextLink href={`/documentos/remision/${row.id}`}>Imprimir</TextLink>
          ) : row.kind === "FACTURA" || row.kind === "FACTURA_LIBRE" || row.kind === "FACTURA_INTERCOMPANIA" ? (
            <TextLink href={`/documentos/factura/${row.id}`}>Imprimir</TextLink>
          ) : null
        }
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
                <Th>{canEditSatLines ? "Claves SAT (editable)" : "Clave SAT"}</Th>
                <Th>Importe</Th>
              </tr>
            </thead>
            <tbody>
              <BillingLineSatEditor
                documentId={row.id}
                lines={row.lines}
                canEdit={canEditSatLines}
                saveAction={updateBillingLineSatAction}
              />
            </tbody>
          </Table>
        </div>
      </Card>

      {canDownloadAndDeliver ? (
        <Card className="mt-4 p-4 text-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Comprobante CFDI 4.0 · Descargas y entrega</h2>
              <p className="text-xs text-[var(--muted)]">
                Descarga los archivos oficiales XML/PDF o envíalos manualmente al cliente.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/billing/documents/${row.id}/pdf?download=1`}
                className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Descargar PDF
              </a>
              <a
                href={`/api/billing/documents/${row.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Ver PDF
              </a>
              <a
                href={`/api/billing/documents/${row.id}/xml`}
                className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Descargar XML
              </a>
              <a
                href={`/api/billing/documents/${row.id}/zip`}
                className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Descargar ZIP
              </a>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-200/80 pt-4 md:grid-cols-2">
            <form action={sendBillingEmailAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="documentId" value={row.id} />
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Correo destinatario (XML + PDF)</span>
                <input
                  name="toEmail"
                  type="email"
                  defaultValue={defaultEmail}
                  placeholder="cliente@empresa.com"
                  className={controlClass}
                />
              </label>
              <Button type="submit" tone="ghost">Enviar por correo</Button>
            </form>

            <form action={sendBillingWhatsAppAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="documentId" value={row.id} />
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">WhatsApp destinatario (PDF)</span>
                <input
                  name="phone"
                  type="tel"
                  defaultValue={defaultPhone}
                  placeholder="10 dígitos o +52…"
                  className={controlClass}
                />
              </label>
              <Button type="submit" tone="ghost">Enviar por WhatsApp</Button>
            </form>
          </div>
        </Card>
      ) : null}

      {showFiscalFields && (row.paymentMethodSnapshot === "PPD" || row.paymentComplementItems.length > 0) ? (
        <Card className="mt-4 p-4 text-sm space-y-3">
          <div>
            <h2 className="font-semibold text-slate-900">Complementos de pago (REP · PPD)</h2>
            <p className="text-xs text-[var(--muted)]">
              Cada abono validado sobre esta factura PPD puede timbrar su CFDI de pago desde el detalle del pago.
            </p>
          </div>
          {row.paymentComplementItems.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Pago</Th>
                  <Th>Parcialidad</Th>
                  <Th>Pagado</Th>
                  <Th>Saldo insoluto</Th>
                  <Th>Estado REP</Th>
                  <Th>Archivos</Th>
                </tr>
              </thead>
              <tbody>
                {row.paymentComplementItems.map((item) => {
                  const rep = item.complement;
                  const badge = repBadgeInfo(rep);
                  const canDl =
                    rep.fiscalStatus === "TIMBRADA"
                    || Boolean(rep.xmlContent)
                    || Boolean(rep.pdfContent)
                    || (Boolean(rep.fiscalExternalId) && rep.fiscalStatus === "CANCELADA");
                  return (
                    <tr key={item.id}>
                      <Td><TextLink href={`/pagos/${rep.payment.id}`}>{rep.payment.folio}</TextLink></Td>
                      <Td>{item.installment}</Td>
                      <Td>{money(item.amountPaid)}</Td>
                      <Td>{money(item.insoluto)}</Td>
                      <Td><Badge tone={badge.tone}>{badge.label}</Badge></Td>
                      <Td>
                        {canDl ? (
                          <span className="flex flex-wrap gap-2 text-xs">
                            <a href={`/api/billing/complements/${rep.id}/pdf`} target="_blank" rel="noreferrer" className="font-medium text-[#0a477e] hover:underline">PDF</a>
                            <a href={`/api/billing/complements/${rep.id}/xml`} className="font-medium text-[#0a477e] hover:underline">XML</a>
                            <a href={`/api/billing/complements/${rep.id}/zip`} className="font-medium text-[#0a477e] hover:underline">ZIP</a>
                          </span>
                        ) : (
                          <TextLink href={`/pagos/${rep.payment.id}`} className="text-xs">Ir al pago</TextLink>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : row.receivable && row.receivable.applications.length > 0 ? (
            <ul className="space-y-1.5 text-xs">
              {row.receivable.applications.map((app) => {
                const rep = app.payment.paymentComplement;
                const badge = repBadgeInfo(rep ?? { fiscalStatus: "PENDIENTE" });
                const canDl =
                  Boolean(rep)
                  && (rep!.fiscalStatus === "TIMBRADA"
                    || Boolean(rep!.xmlContent)
                    || Boolean(rep!.pdfContent));
                return (
                  <li key={app.id} className="flex flex-wrap items-center gap-2">
                    <TextLink href={`/pagos/${app.payment.id}`}>{app.payment.folio}</TextLink>
                    <span>· {money(app.amount)}</span>
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    {canDl && rep ? (
                      <span className="flex gap-2">
                        <a href={`/api/billing/complements/${rep.id}/pdf`} target="_blank" rel="noreferrer" className="font-medium text-[#0a477e] hover:underline">PDF</a>
                        <a href={`/api/billing/complements/${rep.id}/xml`} className="font-medium text-[#0a477e] hover:underline">XML</a>
                        <a href={`/api/billing/complements/${rep.id}/zip`} className="font-medium text-[#0a477e] hover:underline">ZIP</a>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-[var(--muted)]">Aún no hay pagos validados asociados a esta factura.</p>
          )}
        </Card>
      ) : null}

      {showFiscalFields && row.kind !== "NOTA_CREDITO" && row.status === "EMITIDA" && (row.fiscalStatus === "TIMBRADA" || row.fiscalStatus === "SIMULADA") ? (
        <Card className="mt-4 p-4 text-sm space-y-3">
          <div>
            <h2 className="font-semibold text-slate-900">Notas de crédito (CFDI tipo E · relación 01)</h2>
            <p className="text-xs text-[var(--muted)]">
              Saldo acreditable disponible: {money(maxCreditable)}. Al emitirse reduce el saldo pendiente de la cuenta por cobrar.
            </p>
          </div>
          {row.creditNotes.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {row.creditNotes.map((nc) => {
                const ncBadge = fiscalBadgeInfo(nc);
                return (
                  <li key={nc.id} className="flex flex-wrap items-center gap-2">
                    <TextLink href={`/facturacion/${nc.id}`}>{nc.folio}</TextLink>
                    <span>· {nc.concept} · {money(nc.total)}</span>
                    <Badge tone={nc.status === "CANCELADA" ? "danger" : "neutral"}>{nc.status}</Badge>
                    {ncBadge ? <Badge tone={ncBadge.tone}>{ncBadge.label}</Badge> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {canIssue && maxCreditable > 0 ? (
            <form action={issueCreditNoteAction} className="grid gap-3 border-t border-slate-200/80 pt-3 md:grid-cols-4 md:items-end">
              <input type="hidden" name="targetDocumentId" value={row.id} />
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Concepto de la nota de crédito</span>
                <input
                  name="concept"
                  required
                  defaultValue={`Devolución / bonificación sobre ${row.folio}`}
                  className={controlClass}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Importe con IVA</span>
                <MoneyInput name="amount" required min="0.01" defaultValue={maxCreditable} />
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Uso CFDI</span>
                <CfdiUseSelect name="cfdiUse" defaultValue="G02" required />
              </label>
              <label className="md:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Forma de pago (c_FormaPago)</span>
                <PaymentFormSelect name="paymentForm" paymentMethod="PUE" defaultValue={defaultPaymentForm} required />
              </label>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" tone="ghost">Emitir Nota de Crédito</Button>
              </div>
            </form>
          ) : null}
        </Card>
      ) : null}

      {showFiscalFields ? (
      <Card className="mt-4 p-4 text-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">Cancelación fiscal SAT</h2>
            <p className="text-xs text-[var(--muted)]">
              Requiere motivo SAT (01–04), autorización de CEO o Administrador y ejecución sin REP vigentes.
            </p>
          </div>
          {canShowCancelReceipt ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <a
                href={`/api/billing/documents/${row.id}/cancel-receipt/pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 font-semibold text-slate-800 hover:bg-slate-50"
              >
                Acuse cancelación PDF
              </a>
              <a
                href={`/api/billing/documents/${row.id}/cancel-receipt/xml`}
                className="inline-flex min-h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 font-semibold text-slate-800 hover:bg-slate-50"
              >
                Acuse cancelación XML
              </a>
            </div>
          ) : null}
        </div>

        {row.status === "CANCELADA" ? (
          <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
            Documento cancelado{row.cancelMotive ? ` · Motivo SAT ${row.cancelMotive}` : ""}
            {row.substitutionDocument ? ` · Sustituye: ${row.substitutionDocument.folio}` : ""}
            {row.canceledAt ? ` · ${formatWhen(row.canceledAt)}` : ""}.
          </p>
        ) : isCancelPendingSat ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">
              Cancelación en proceso (esperando receptor/SAT · estado: {row.cancellationStatus}). El documento sigue vigente hasta confirmarse.
            </p>
            {canIssue ? (
              <form action={pollCancelStatusAction}>
                <input type="hidden" name="documentId" value={row.id} />
                <Button type="submit" tone="ghost">Consultar estatus cancelación</Button>
              </form>
            ) : null}
          </div>
        ) : (
          <>
            {hasActiveRep ? (
              <p className="rounded-md bg-[var(--warn-soft)] px-3 py-2 text-xs">
                Esta factura PPD tiene un Complemento de Pago (REP) vigente. Cancela primero el REP desde el detalle del pago para poder cancelar esta factura.
              </p>
            ) : null}

            {row.cancelRequestedAt && !row.cancelAuthorizedByUserId ? (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <p>
                  <strong>Solicitud pendiente de autorización:</strong> Motivo SAT {row.cancelMotive}
                  {row.substitutionDocument ? ` · Sustituta: ${row.substitutionDocument.folio}` : ""}.
                </p>
                {canAuthorizeCancel ? (
                  <div className="flex flex-wrap gap-2">
                    <form action={authorizeCancelDocumentAction}>
                      <input type="hidden" name="documentId" value={row.id} />
                      <Button type="submit" tone="ghost">Autorizar cancelación</Button>
                    </form>
                    <form action={authorizeAndExecuteCancelAction}>
                      <input type="hidden" name="documentId" value={row.id} />
                      <Button type="submit" tone="danger">Autorizar y cancelar ante SAT</Button>
                    </form>
                  </div>
                ) : (
                  <p className="text-[var(--muted)]">Esperando autorización de CEO o Administrador.</p>
                )}
              </div>
            ) : row.cancelRequestedAt && row.cancelAuthorizedByUserId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <p>
                  <strong>Cancelación autorizada:</strong> Motivo SAT {row.cancelMotive}
                  {row.substitutionDocument ? ` · Sustituta: ${row.substitutionDocument.folio}` : ""}.
                </p>
                {canIssue ? (
                  <form action={executeCancelDocumentAction}>
                    <input type="hidden" name="documentId" value={row.id} />
                    <Button type="submit" tone="danger">Ejecutar cancelación SAT</Button>
                  </form>
                ) : null}
              </div>
            ) : null}

            {canRequestCancel && (!row.cancelRequestedAt || row.cancellationStatus === "rejected" || row.cancellationStatus === "expired") ? (
              <form action={requestCancelDocumentAction} className="grid gap-3 border-t border-slate-200/80 pt-3 md:grid-cols-3 md:items-end">
                <input type="hidden" name="documentId" value={row.id} />
                <label>
                  <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Motivo SAT</span>
                  <select name="motive" defaultValue="02" className={controlClass} required>
                    {SAT_CANCEL_MOTIVES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Factura sustituta (obligatoria en 01 y 04)</span>
                  <select name="substitutionDocId" defaultValue="" className={controlClass}>
                    <option value="">Ninguna</option>
                    {substitutionCandidates.map((cand) => (
                      <option key={cand.id} value={cand.id}>
                        {cand.folio} · {money(cand.total)}
                      </option>
                    ))}
                  </select>
                </label>
                <div>
                  <Button type="submit" tone="ghost">Solicitar cancelación</Button>
                </div>
              </form>
            ) : null}
          </>
        )}
      </Card>
      ) : null}

      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
