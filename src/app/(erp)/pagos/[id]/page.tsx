import { notFound, redirect } from "next/navigation";
import { confirmIntercompanyAction, validatePaymentAction } from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { ClientNameLink } from "@/components/client-entity-links";
import { Badge, Button, EntityDetailHeader, EntityMetaItem, TextLink } from "@/components/ui";
import { homePath } from "@/lib/home";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function PagoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "payment.register", session.activeCompanyCode) && !can(session.role, "payment.validate", session.activeCompanyCode)) redirect(homePath(session.role, session.activeCompanyCode));
  const { id } = await params;
  const row = await prisma.payment.findFirst({
    where: session.activeCompanyCode === "SERVOMOTORES" && can(session.role, "payment.validate", session.activeCompanyCode)
      ? { id, OR: [{ companyId: session.activeCompanyId }, { kind: "INTERCOMPANIA" }] }
      : { id, companyId: session.activeCompanyId },
    include: { client: true, applications: { include: { receivable: { include: { document: true } } } } },
  });
  if (!row) notFound();
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const canValidate = can(session.role, "payment.validate", session.activeCompanyCode);
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

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/pagos", label: "Pagos" }}
        title={row.folio}
        subtitle={row.kind === "INTERCOMPANIA" ? "Pago intercompañía" : "Pago de cliente"}
        status={<Badge tone={row.status === "PENDIENTE" ? "warn" : "neutral"}>{row.status === "PENDIENTE" ? "Pendiente de validar" : "Validado"}</Badge>}
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
        <section className="mb-4 rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
          <h2 className="font-medium">Aplicado a</h2>
          <ul className="mt-2 space-y-1">
            {applied.map((item) => (
              <li key={item.id}>
                {item.receivable && item.receivableId ? (
                  <TextLink href={`/cobranza/${item.receivableId}`}>{item.receivable.document.folio}</TextLink>
                ) : (
                  "Cuenta por pagar"
                )}
                {" · "}
                {money(item.amount)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
