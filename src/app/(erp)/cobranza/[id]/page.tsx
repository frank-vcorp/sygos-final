import { notFound, redirect } from "next/navigation";
import { collectionNoteAction } from "../actions";
import { ClientNameLink } from "@/components/client-entity-links";
import { Badge, Button, controlClass, DetailAnchorButton, EntityDetailHeader, EntityMetaItem, Field, TextLink } from "@/components/ui";
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
    include: { client: true, document: true, notes: { orderBy: { createdAt: "desc" } }, applications: { include: { payment: true } } },
  });
  if (!row) notFound();
  await redirectIfSalesNotAssigned(session, row.sellerUserId, "/cobranza");
  const canEditClient = can(session.role, "client.edit", session.activeCompanyCode);
  const canNote = session.role !== "ALMACEN";
  const overdue = row.balance > 0 && row.dueAt.getTime() < Date.now();
  const statusLabel = overdue ? "Vencida" : row.status === "SALDADA" ? "Saldada" : row.status === "PARCIAL" ? "Parcial" : "Abierta";
  const confirmedApps = row.applications.filter((item) => item.confirmedAt);

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
        secondaryActions={can(session.role, "payment.register", session.activeCompanyCode) ? <TextLink href="/pagos/nuevo">Registrar pago</TextLink> : null}
      />
      <section className="mb-4 rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
        <h2 className="font-medium">Pagos aplicados</h2>
        {confirmedApps.length === 0 ? <p className="mt-1 text-[var(--muted)]">Todavía no hay un pago validado.</p> : (
          <ul className="mt-2 space-y-1">
            {confirmedApps.map((item) => (
              <li key={item.id}>
                <TextLink href={`/pagos/${item.payment.id}`}>{item.payment.folio}</TextLink>
                {" · "}
                {money(item.amount)}
              </li>
            ))}
          </ul>
        )}
      </section>
      {canNote ? (
        <form id="seguimiento-cobranza" action={collectionNoteAction} className="grid max-w-xl scroll-mt-24 gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Seguimiento de cobranza</h2>
          <input type="hidden" name="receivableId" value={row.id} />
          <Field label="Nota"><textarea name="note" required rows={3} className={controlClass} /></Field>
          <Field label="Próximo seguimiento"><input name="followUpAt" type="datetime-local" className={controlClass} /></Field>
          <Button type="submit" tone="ghost">Guardar seguimiento</Button>
        </form>
      ) : null}
      {row.notes.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {row.notes.map((note) => (
            <li key={note.id} className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
              <span className="text-[var(--muted)]">{formatWhen(note.createdAt)}</span> · {note.note}
              {note.followUpAt ? ` · siguiente ${formatWhen(note.followUpAt)}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
