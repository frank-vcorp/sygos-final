import { notFound, redirect } from "next/navigation";
import { collectionNoteAction } from "../actions";
import { ClientNameLink } from "@/components/client-entity-links";
import { RegisterPaymentDialog } from "@/app/(erp)/pagos/register-payment-dialog";
import { getPaymentFormOptions } from "@/app/(erp)/pagos/payment-form-data";
import { Badge, Button, Card, controlClass, DetailAnchorButton, EntityDetailHeader, EntityMetaItem, Field, FormActions, FormPanel, FormSection, MobileCard, TextLink } from "@/components/ui";
import { repBadgeInfo } from "@/lib/billing-badges";
import { isBillingDocumentEligibleForRep } from "@/lib/facturapi";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { redirectIfSalesNotAssigned } from "@/lib/sales-assignment";
import { requireCompany } from "@/lib/session";

export default async function CuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "receivable.view", session.activeCompanyCode)) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.receivable.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: {
      client: true,
      document: true,
      notes: { orderBy: { createdAt: "desc" } },
      applications: {
        include: {
          payment: {
            include: {
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
  });
  if (!row) notFound();
  await redirectIfSalesNotAssigned(session, row.sellerUserId, "/cobranza");
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const canNote = session.role !== "ALMACEN";
  const overdue = row.balance > 0 && row.dueAt.getTime() < Date.now();
  const statusLabel = overdue ? "Vencida" : row.status === "SALDADA" ? "Saldada" : row.status === "PARCIAL" ? "Parcial" : "Abierta";
  const confirmedApps = row.applications.filter((item) => item.confirmedAt);
  const canRegisterPayment = can(session.role, "payment.register", session.activeCompanyCode);
  const paymentFormOptions = canRegisterPayment ? await getPaymentFormOptions(session) : { receivables: [], payables: [] };

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/cobranza", label: "Cobranza" }}
        title={row.document.folio}
        subtitle={row.client.isSystem ? "SYSTRON · intercompañía" : row.client.name}
        status={<Badge tone={overdue ? "warn" : "neutral"}>{statusLabel}</Badge>}
        meta={
          <>
            <EntityMetaItem label="Cliente">
              <ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} />
            </EntityMetaItem>
            <EntityMetaItem label="Saldo">{money(row.balance)}</EntityMetaItem>
            <EntityMetaItem label="Original">{money(row.amount)}</EntityMetaItem>
            <EntityMetaItem label="Vence">{formatWhen(row.dueAt)}</EntityMetaItem>
            <EntityMetaItem label="Factura">
              <TextLink href={`/facturacion/${row.document.id}`}>{row.document.folio}</TextLink>
            </EntityMetaItem>
          </>
        }
        primaryAction={canNote && row.balance > 0 ? <DetailAnchorButton href="#seguimiento-cobranza">Registrar seguimiento</DetailAnchorButton> : null}
        secondaryActions={
          canRegisterPayment ? (
            <RegisterPaymentDialog
              receivables={paymentFormOptions.receivables}
              payables={paymentFormOptions.payables}
              defaultReceivableId={row.id}
              triggerVariant="text"
            />
          ) : null
        }
      />
      <Card className="mb-4 p-4 text-sm">
        <h2 className="font-medium">Pagos aplicados</h2>
        {confirmedApps.length === 0 ? <p className="mt-1 text-[var(--muted)]">Todavía no hay un pago validado.</p> : (
          <ul className="mt-2 space-y-2">
            {confirmedApps.map((item) => {
              const rep = item.payment.paymentComplement;
              const isEligiblePpd = isBillingDocumentEligibleForRep(row.document);
              const repBadge = rep ? repBadgeInfo(rep) : isEligiblePpd ? repBadgeInfo({ fiscalStatus: "PENDIENTE" }) : null;
              const canDownloadRep =
                Boolean(rep)
                && (rep!.fiscalStatus === "TIMBRADA"
                  || Boolean(rep!.xmlContent)
                  || Boolean(rep!.pdfContent)
                  || (Boolean(rep!.fiscalExternalId) && rep!.fiscalStatus === "CANCELADA"));
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-2">
                  <TextLink href={`/pagos/${item.payment.id}`}>{item.payment.folio}</TextLink>
                  <span>· {money(item.amount)}</span>
                  {repBadge ? <Badge tone={repBadge.tone}>{repBadge.label}</Badge> : null}
                  {canDownloadRep && rep ? (
                    <span className="flex flex-wrap gap-2 text-xs">
                      <a href={`/api/billing/complements/${rep.id}/pdf`} target="_blank" rel="noreferrer" className="font-medium text-[#0a477e] hover:underline">PDF</a>
                      <a href={`/api/billing/complements/${rep.id}/xml`} className="font-medium text-[#0a477e] hover:underline">XML</a>
                      <a href={`/api/billing/complements/${rep.id}/zip`} className="font-medium text-[#0a477e] hover:underline">ZIP</a>
                    </span>
                  ) : isEligiblePpd ? (
                    <TextLink href={`/pagos/${item.payment.id}`} className="text-xs">Gestionar REP</TextLink>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {canNote ? (
        <FormPanel id="seguimiento-cobranza" action={collectionNoteAction} className="max-w-xl scroll-mt-24">
          <input type="hidden" name="receivableId" value={row.id} />
          <FormSection title="Seguimiento de cobranza" columns={1}>
            <Field label="Nota"><textarea name="note" required rows={3} className={controlClass} /></Field>
            <Field label="Próximo seguimiento"><input name="followUpAt" type="datetime-local" className={controlClass} /></Field>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Guardar seguimiento</Button></FormActions>
        </FormPanel>
      ) : null}
      {row.notes.length > 0 ? (
        <ul className="mt-4 grid gap-3 text-sm">
          {row.notes.map((note) => (
            <li key={note.id}>
              <MobileCard title={formatWhen(note.createdAt)}>
                <p>{note.note}{note.followUpAt ? ` · siguiente ${formatWhen(note.followUpAt)}` : ""}</p>
              </MobileCard>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
