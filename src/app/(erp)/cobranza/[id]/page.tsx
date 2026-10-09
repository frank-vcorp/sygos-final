import { notFound, redirect } from "next/navigation";
import { collectionNoteAction } from "../actions";
import { ClientNameLink } from "@/components/client-entity-links";
import { Badge, controlClass, Field, PageHeader, TextLink } from "@/components/ui";
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
  const overdue = row.balance > 0 && row.dueAt.getTime() < Date.now();
  return (
    <>
      <PageHeader back={{ href: "/cobranza", label: "Cobranza" }} title={row.document.folio} subtitle={row.client.isSystem ? "SYSTRON · intercompañía" : row.client.name} action={<Badge tone={overdue ? "warn" : "neutral"}>{overdue ? "Vencida" : row.status}</Badge>} />
      <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
        <p>Cliente: <ClientNameLink clientId={row.client.id} name={row.client.name} isSystem={row.client.isSystem} canEdit={canEditClient} /></p>
        <p className="mt-1">Factura: <TextLink href={`/facturacion/${row.document.id}`}>{row.document.folio}</TextLink></p>
        <p className="mt-1">Saldo {money(row.balance)} de {money(row.amount)}. Vence {formatWhen(row.dueAt)}.</p>
        <h2 className="mt-4 font-medium">Pagos aplicados</h2>
        {row.applications.filter((item) => item.confirmedAt).length === 0 ? <p className="mt-1 text-[var(--muted)]">Todavía no hay un pago validado.</p> : (
          <ul className="mt-1">{row.applications.filter((item) => item.confirmedAt).map((item) => <li key={item.id}>{item.payment.folio} · {money(item.amount)}</li>)}</ul>
        )}
      </section>
      <form action={collectionNoteAction} className="mt-4 grid max-w-xl gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
        <h2 className="font-medium">Seguimiento</h2>
        <input type="hidden" name="receivableId" value={row.id} />
        <Field label="Nota"><textarea name="note" required rows={3} className={controlClass} /></Field>
        <Field label="Próximo seguimiento"><input name="followUpAt" type="datetime-local" className={controlClass} /></Field>
        <button className="w-fit rounded-md border border-[var(--line)] px-3 py-2 text-sm">Registrar seguimiento</button>
      </form>
      <ul className="mt-4 space-y-2 text-sm">
        {row.notes.map((note) => <li key={note.id}><span className="text-[var(--muted)]">{formatWhen(note.createdAt)}</span> · {note.note}{note.followUpAt ? ` · siguiente ${formatWhen(note.followUpAt)}` : ""}</li>)}
      </ul>
    </>
  );
}
