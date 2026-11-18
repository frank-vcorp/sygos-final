import { notFound, redirect } from "next/navigation";
import {
  cancelPaymentRepAction,
  confirmIntercompanyAction,
  pollRepCancellationAction,
  sendRepEmailAction,
  sendRepWhatsAppAction,
  stampPaymentRepAction,
  validatePaymentAction,
} from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { ClientNameLink } from "@/components/client-entity-links";
import { Badge, Button, Card, controlClass, EntityDetailHeader, EntityMetaItem, Table, Td, TextLink, Th } from "@/components/ui";
import { repBadgeInfo } from "@/lib/billing-badges";
import {
  resolveBillingDocumentEmailRecipient,
  resolveBillingDocumentWhatsAppPhone,
} from "@/lib/billing-delivery";
import { isBillingDocumentEligibleForRep, SAT_CANCEL_MOTIVES } from "@/lib/facturapi";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { paymentFormLabel, satFormaPagoForOperationalPayment } from "@/lib/sat-payment-method";
import { requireCompany } from "@/lib/session";

export default async function PagoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "payment.register", session.activeCompanyCode) && !can(session.role, "payment.validate", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { id } = await params;
  const row = await prisma.payment.findFirst({
    where: session.activeCompanyCode === "SERVOMOTORES" && can(session.role, "payment.validate", session.activeCompanyCode)
      ? { id, OR: [{ companyId: session.activeCompanyId }, { kind: "INTERCOMPANIA" }] }
      : { id, companyId: session.activeCompanyId },
    include: {
      client: {
        include: {
          contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        },
      },
      applications: {
        include: {
          receivable: { include: { document: true } },
          payable: { include: { document: true } },
        },
      },
      paymentComplement: {
        include: {
          company: true,
          client: {
            include: {
              contacts: { where: { active: true }, orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
            },
          },
          items: { include: { billingDocument: true } },
        },
      },
    },
  });
  if (!row) notFound();
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const canValidate = can(session.role, "payment.validate", session.activeCompanyCode);
  const canStampRepPerm =
    canValidate || can(session.role, "invoice.issue", session.activeCompanyCode);
  const canOperateRepHere =
    canStampRepPerm
    && (row.kind === "INTERCOMPANIA"
      ? session.activeCompanyCode === "SERVOMOTORES"
      : row.companyId === session.activeCompanyId);

  const history = await historyFor("PAGO", row.id);

  let primaryAction: React.ReactNode = null;
  if (row.status === "PENDIENTE" && row.kind === "CLIENTE" && canValidate) {
    primaryAction = (
      <form action={validatePaymentAction} className="inline">
        <input type="hidden" name="paymentId" value={row.id} />
        <Button type="submit">Validar pago</Button>
      </form>
    );
  } else if (row.status === "PENDIENTE" && row.kind === "INTERCOMPANIA" && session.activeCompanyCode === "SERVOMOTORES" && canValidate) {
    primaryAction = (
      <form action={confirmIntercompanyAction} className="inline">
        <input type="hidden" name="paymentId" value={row.id} />
        <Button type="submit">Confirmar entrada</Button>
      </form>
    );
  }

  const applied = row.applications.filter((item) => item.confirmedAt);
  const eligiblePpdDocs = row.status === "VALIDADO"
    ? row.applications
        .map((item) => (row.kind === "INTERCOMPANIA" ? item.payable?.document : item.receivable?.document))
        .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc) && isBillingDocumentEligibleForRep(doc!))
    : [];
  const rep = row.paymentComplement;
  const showRepSection = Boolean(rep) || eligiblePpdDocs.length > 0;
  const repBadge = rep ? repBadgeInfo(rep) : eligiblePpdDocs.length > 0 ? repBadgeInfo({ fiscalStatus: "PENDIENTE" }) : null;
  const repPaymentForm = rep?.paymentForm ?? satFormaPagoForOperationalPayment(row.method);

  const canActionRep =
    canOperateRepHere
    && row.status === "VALIDADO"
    && eligiblePpdDocs.length > 0
    && (!rep || rep.fiscalStatus === "PENDIENTE" || rep.fiscalStatus === "ERROR" || rep.fiscalStatus === "PROCESANDO");

  const repActionLabel =
    rep?.fiscalStatus === "PROCESANDO"
      ? "Consultar estatus REP"
      : rep?.fiscalStatus === "ERROR"
        ? "Reintentar REP"
        : "Timbrar complemento de pago (REP)";

  const canDownloadRep =
    Boolean(rep)
    && (rep!.fiscalStatus === "TIMBRADA"
      || Boolean(rep!.xmlContent)
      || Boolean(rep!.pdfContent)
      || (Boolean(rep!.fiscalExternalId) && rep!.fiscalStatus === "CANCELADA"));

  const canDeliverRep =
    canDownloadRep
    && (row.kind === "INTERCOMPANIA"
      ? session.activeCompanyCode === "SERVOMOTORES"
      : row.companyId === session.activeCompanyId);

  const defaultRepEmail = rep ? (resolveBillingDocumentEmailRecipient(rep) ?? "") : "";
  const defaultRepPhone = rep ? (resolveBillingDocumentWhatsAppPhone(rep) ?? "") : "";

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/pagos", label: "Pagos" }}
        title={row.folio}
        subtitle={row.kind === "INTERCOMPANIA" ? "Pago intercompañía" : "Pago de cliente"}
        status={
          <span className="flex flex-wrap gap-1.5">
            <Badge tone={row.status === "PENDIENTE" ? "warn" : "neutral"}>{row.status === "PENDIENTE" ? "Pendiente de validar" : "Validado"}</Badge>
            {repBadge ? <Badge tone={repBadge.tone}>{repBadge.label}</Badge> : null}
          </span>
        }
        meta={
          <>
            {row.kind === "CLIENTE" && row.client ? (
              <EntityMetaItem label="Cliente">
                <ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />
              </EntityMetaItem>
            ) : null}
            <EntityMetaItem label="Importe">{money(row.amount)}</EntityMetaItem>
            <EntityMetaItem label="Forma">{row.method === "EFECTIVO" ? "Efectivo" : "Transferencia"}</EntityMetaItem>
            <EntityMetaItem label="Destino">{row.destination}</EntityMetaItem>
            <EntityMetaItem label="Comprobante">{row.receipt}</EntityMetaItem>
            <EntityMetaItem label="Registrado">{formatWhen(row.createdAt)}</EntityMetaItem>
          </>
        }
        primaryAction={primaryAction}
      />

      {applied.length > 0 ? (
        <Card className="mb-4 p-4 text-sm">
          <h2 className="font-medium">Aplicado a</h2>
          <ul className="mt-2 space-y-1">
            {applied.map((item) => {
              const payableDoc = item.payable?.document;
              return (
                <li key={item.id}>
                  {item.receivable && item.receivableId ? (
                    <TextLink href={`/cobranza/${item.receivableId}`}>{item.receivable.document.folio}</TextLink>
                  ) : payableDoc ? (
                    session.activeCompanyCode === "SERVOMOTORES" ? (
                      <TextLink href={`/facturacion/${payableDoc.id}`}>{payableDoc.folio}</TextLink>
                    ) : (
                      <span>{payableDoc.folio} (Servomotores → SYSTRON)</span>
                    )
                  ) : (
                    "Cuenta por pagar"
                  )}
                  {" · "}
                  {money(item.amount)}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {showRepSection ? (
        <Card className="mb-4 p-4 text-sm space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-slate-900">Complemento de pago (REP · CFDI tipo P)</h2>
                {repBadge ? <Badge tone={repBadge.tone}>{repBadge.label}</Badge> : null}
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {row.kind === "INTERCOMPANIA"
                  ? "Emisor: Servomotores → Receptor: SYSTRON. "
                  : ""}
                Forma SAT: {paymentFormLabel(repPaymentForm)}
                {rep?.fiscalUuid ? ` · UUID: ${rep.fiscalUuid}` : ""}
              </p>
              {row.kind === "INTERCOMPANIA" && session.activeCompanyCode !== "SERVOMOTORES" && (!rep || rep.fiscalStatus !== "TIMBRADA") ? (
                <p className="mt-1 text-xs text-slate-600">El REP lo timbra Servomotores desde su empresa activa.</p>
              ) : null}
            </div>
            {canActionRep ? (
              <form action={stampPaymentRepAction}>
                <input type="hidden" name="paymentId" value={row.id} />
                <Button type="submit" tone={rep?.fiscalStatus === "ERROR" || rep?.fiscalStatus === "PROCESANDO" ? "ghost" : undefined}>
                  {repActionLabel}
                </Button>
              </form>
            ) : null}
          </div>

          {rep?.fiscalEnv === "TEST" && rep.fiscalStatus === "TIMBRADA" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              TIMBRE DE PRUEBA (SANDBOX): Este complemento de pago se timbró con una llave sk_test_ de Facturapi y no tiene validez ante el SAT.
            </div>
          ) : null}

          {rep?.fiscalError ? (
            <p className="rounded-md bg-[var(--warn-soft)] px-3 py-2 text-xs">{rep.fiscalError}</p>
          ) : null}

          {rep && rep.items.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Factura PPD</Th>
                  <Th>Parcialidad</Th>
                  <Th>Saldo anterior</Th>
                  <Th>Pagado</Th>
                  <Th>Saldo insoluto</Th>
                </tr>
              </thead>
              <tbody>
                {rep.items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      {item.billingDocument.companyId === session.activeCompanyId ? (
                        <TextLink href={`/facturacion/${item.billingDocumentId}`}>{item.billingDocument.folio}</TextLink>
                      ) : (
                        item.billingDocument.folio
                      )}
                    </Td>
                    <Td>{item.installment}</Td>
                    <Td>{money(item.lastBalance)}</Td>
                    <Td>{money(item.amountPaid)}</Td>
                    <Td>{money(item.insoluto)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}

          {canDownloadRep && rep ? (
            <div className="space-y-4 border-t border-slate-200/80 pt-3">
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/billing/complements/${rep.id}/pdf?download=1`}
                  className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Descargar PDF
                </a>
                <a
                  href={`/api/billing/complements/${rep.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Ver PDF
                </a>
                <a
                  href={`/api/billing/complements/${rep.id}/xml`}
                  className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Descargar XML
                </a>
                <a
                  href={`/api/billing/complements/${rep.id}/zip`}
                  className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Descargar ZIP
                </a>
              </div>

              {canDeliverRep ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <form action={sendRepEmailAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="paymentId" value={row.id} />
                    <input type="hidden" name="complementId" value={rep.id} />
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Correo destinatario (XML + PDF)</span>
                      <input
                        name="toEmail"
                        type="email"
                        defaultValue={defaultRepEmail}
                        placeholder="cliente@empresa.com"
                        className={controlClass}
                      />
                    </label>
                    <Button type="submit" tone="ghost">Enviar por correo</Button>
                  </form>

                  <form action={sendRepWhatsAppAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="paymentId" value={row.id} />
                    <input type="hidden" name="complementId" value={rep.id} />
                    <label className="min-w-0 flex-1">
                      <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">WhatsApp destinatario (PDF)</span>
                      <input
                        name="phone"
                        type="tel"
                        defaultValue={defaultRepPhone}
                        placeholder="10 dígitos o +52…"
                        className={controlClass}
                      />
                    </label>
                    <Button type="submit" tone="ghost">Enviar por WhatsApp</Button>
                  </form>
                </div>
              ) : null}
            </div>
          ) : null}

          {rep && canOperateRepHere && rep.fiscalStatus !== "CANCELADA" && (rep.fiscalStatus === "TIMBRADA" || rep.fiscalStatus === "SIMULADA") ? (
            <div className="border-t border-slate-200/80 pt-3">
              {rep.cancellationStatus === "pending" || rep.cancellationStatus === "verifying" ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span>Cancelación del REP en proceso ({rep.cancellationStatus}).</span>
                  <form action={pollRepCancellationAction}>
                    <input type="hidden" name="paymentId" value={row.id} />
                    <input type="hidden" name="complementId" value={rep.id} />
                    <Button type="submit" tone="ghost">Consultar estatus cancelación REP</Button>
                  </form>
                </div>
              ) : (
                <form action={cancelPaymentRepAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="paymentId" value={row.id} />
                  <input type="hidden" name="complementId" value={rep.id} />
                  <label className="min-w-0 flex-1">
                    <span className="mb-1 block text-xs font-semibold text-[var(--ink)]">Cancelar REP ante SAT (desbloquea cancelación de factura PPD)</span>
                    <select name="motive" defaultValue="02" className={controlClass}>
                      {SAT_CANCEL_MOTIVES.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" tone="danger">Cancelar REP</Button>
                </form>
              )}
            </div>
          ) : null}
        </Card>
      ) : null}

      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
