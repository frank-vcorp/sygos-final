import { notFound, redirect } from "next/navigation";
import { confirmIntercompanyAction, validatePaymentAction } from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import { Badge, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function PagoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "payment.register", session.activeCompanyCode) && !can(session.role, "payment.validate", session.activeCompanyCode)) redirect("/inicio");
  const { id } = await params;
  const row = await prisma.payment.findFirst({
    where: session.activeCompanyCode === "SERVOMOTORES" && can(session.role, "payment.validate", session.activeCompanyCode)
      ? { id, OR: [{ companyId: session.activeCompanyId }, { kind: "INTERCOMPANIA" }] }
      : { id, companyId: session.activeCompanyId },
    include: { client: true },
  });
  if (!row) notFound();
  const history = await historyFor("PAGO", row.id);
  return (
    <>
      <PageHeader back={{ href: "/pagos", label: "Pagos" }} title={row.folio} subtitle={row.kind === "INTERCOMPANIA" ? "Pago intercompañía" : row.client?.name ?? "Pago"} action={<Badge tone={row.status === "PENDIENTE" ? "warn" : "neutral"}>{row.status === "PENDIENTE" ? "Pendiente" : "Validado"}</Badge>} />
      <section className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
        <p>Importe {money(row.amount)} · {row.method === "EFECTIVO" ? "Efectivo" : "Transferencia"}</p>
        <p className="mt-1">Comprobante: {row.receipt}</p>
        <p className="mt-1">Destino: {row.destination}</p>
        <p className="mt-1 text-[var(--muted)]">{formatWhen(row.createdAt)}</p>
        {row.status === "PENDIENTE" && row.kind === "CLIENTE" && can(session.role, "payment.validate", session.activeCompanyCode) ? (
          <form action={validatePaymentAction} className="mt-3">
            <input type="hidden" name="paymentId" value={row.id} />
            <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Validar pago</button>
          </form>
        ) : null}
        {row.status === "PENDIENTE" && row.kind === "INTERCOMPANIA" && session.activeCompanyCode === "SERVOMOTORES" && can(session.role, "payment.validate", session.activeCompanyCode) ? (
          <form action={confirmIntercompanyAction} className="mt-3">
            <input type="hidden" name="paymentId" value={row.id} />
            <button className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Confirmar entrada</button>
          </form>
        ) : null}
      </section>
      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
