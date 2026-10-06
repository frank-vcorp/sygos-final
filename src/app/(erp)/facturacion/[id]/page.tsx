import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { issueDocumentAction, retryFiscalAction } from "../actions";
import { Badge, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "invoice.request", session.activeCompanyCode) && !can(session.role, "invoice.issue", session.activeCompanyCode)) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.billingDocument.findFirst({
    where: { id, companyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { client: { ownerUserId: session.userId } } : {}) },
    include: { client: true, quote: true, receivable: true, lines: true },
  });
  if (!row) notFound();
  const history = await historyFor("DOCUMENTO", row.id);
  return (
    <>
      <PageHeader back={{ href: "/facturacion", label: "Facturación" }} title={row.folio} subtitle={row.kind === "REMISION" ? "Remisión" : "Factura"} action={<Badge>{row.status === "SOLICITADA" ? "Solicitada" : "Emitida"}</Badge>} />
      <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
        <p>Cliente: <Link href={`/clientes/${row.client.id}`} className="text-[var(--accent)]">{row.client.isSystem ? "SYSTRON · intercompañía" : row.client.name}</Link></p>
        {row.quote ? <p className="mt-1">Cotización: <Link href={`/cotizaciones/${row.quote.id}`} className="text-[var(--accent)]">{row.quote.folio}</Link></p> : null}
        {row.rfcSnapshot ? <p className="mt-1">RFC congelado: {row.rfcSnapshot}</p> : null}
        <p className="mt-1">Subtotal {money(row.subtotal)} · IVA {money(row.iva)} · total {money(row.total)}</p>
        {row.issuedAt ? <p className="mt-1">Emitida {formatWhen(row.issuedAt)}. Vence {row.dueAt ? formatWhen(row.dueAt) : "—"}.</p> : null}
        {row.receivable ? <p className="mt-1">Cuenta por cobrar: <Link href={`/cobranza/${row.receivable.id}`} className="text-[var(--accent)]">{money(row.receivable.balance)}</Link></p> : null}
        {row.fiscalError ? <p className="mt-3 rounded-md bg-[var(--warn-soft)] px-3 py-2">{row.fiscalError}</p> : null}
        <ul className="mt-3 space-y-1">{row.lines.map((line) => <li key={line.id}>{line.concept} · {money(line.amount)}</li>)}</ul>
        {row.status === "SOLICITADA" && can(session.role, "invoice.issue", session.activeCompanyCode) ? (
          <form action={issueDocumentAction} className="mt-3">
            <input type="hidden" name="documentId" value={row.id} />
            <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Emitir</button>
          </form>
        ) : null}
        {row.fiscalStatus === "ERROR" && can(session.role, "invoice.issue", session.activeCompanyCode) ? (
          <form action={retryFiscalAction} className="mt-2">
            <input type="hidden" name="documentId" value={row.id} />
            <button className="rounded-md border border-[var(--line)] px-3 py-2 text-sm">Reintentar timbrado</button>
          </form>
        ) : null}
      </section>
      <ul className="mt-4 space-y-2 text-sm">{history.map((item) => <li key={item.id}><span className="text-[var(--muted)]">{formatWhen(item.createdAt)}</span> · {item.summary}</li>)}</ul>
    </>
  );
}
