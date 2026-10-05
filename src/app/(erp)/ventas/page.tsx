import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { can } from "@/lib/permissions";
import { QUOTE_STATUS_LABEL } from "@/lib/quotes";
import { requireCompany } from "@/lib/session";

export default async function VentasPage() {
  const session = await requireCompany();
  if (!can(session.role, "agenda.use", session.activeCompanyCode) && !can(session.role, "quote.follow", session.activeCompanyCode)) redirect("/inicio");
  const own = session.role === "VENTAS" ? { sellerUserId: session.userId } : {};
  const [pending, agenda, goals] = await Promise.all([
    prisma.quote.findMany({
      where: { companyId: session.activeCompanyId, status: "PENDIENTE_DECISION", ...own },
      include: { client: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.agendaActivity.findMany({
      where: { companyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { authorUserId: session.userId } : {}), scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 8,
      include: { category: true },
    }),
    session.activeCompanyCode === "SYSTRON"
      ? prisma.salesGoal.findMany({
          where: { companyId: session.activeCompanyId, ...(session.role === "VENTAS" ? { userId: session.userId } : {}), year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
          include: { goalType: true },
        })
      : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader title="Panel de ventas" subtitle="Decisiones pendientes y próximas actividades. No hay recordatorios automáticos." action={<Link href="/agenda" className="text-sm text-[var(--accent)]">Abrir agenda</Link>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Pendientes de decisión</h2>
          {pending.length === 0 ? <p className="mt-2 text-sm text-[var(--muted)]">Nada esperando al cliente.</p> : (
            <ul className="mt-2 space-y-2 text-sm">
              {pending.map((quote) => <li key={quote.id}><Link href={`/cotizaciones/${quote.id}`} className="text-[var(--accent)]">{quote.folio}</Link> · {quote.client.name} · {QUOTE_STATUS_LABEL[quote.status]}</li>)}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Agenda</h2>
          {agenda.length === 0 ? <Empty title="Sin actividades próximas" body="Registra una desde la agenda. No se crean tareas solas." /> : (
            <ul className="mt-2 space-y-2 text-sm">
              {agenda.map((item) => <li key={item.id}>{formatWhen(item.scheduledAt)} · {item.category?.name ?? "Actividad"} · {item.note}</li>)}
            </ul>
          )}
        </section>
        {goals.length > 0 ? (
          <section className="rounded-lg border border-[var(--line)] bg-white p-4">
            <h2 className="font-medium">Metas del mes</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {goals.map((goal) => <li key={goal.id}>{goal.goalType.name}: objetivo {goal.target}</li>)}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
