import { notFound, redirect } from "next/navigation";
import { issueDocumentAction, retryFiscalAction, sendBillingEmailAction, sendBillingWhatsAppAction } from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { ClientNameLink } from "@/components/client-entity-links";
import { IssueBillingDocumentForm } from "@/components/issue-billing-document-form";
import { Badge, Button, Card, controlClass, EntityDetailHeader, EntityMetaItem, Table, Td, TextLink, Th } from "@/components/ui";
import { fiscalBadgeInfo, repBadgeInfo } from "@/lib/billing-badges";
import {
  resolveBillingDocumentEmailRecipient,
  resolveBillingDocumentWhatsAppPhone,
} from "@/lib/billing-delivery";
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
      lines: true,
    },
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

      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
