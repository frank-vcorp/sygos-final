import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Empty, PageHeader, Table, Td, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money, quoteTotals } from "@/lib/money";
import { can } from "@/lib/permissions";
import { QUOTE_STATUS_LABEL, QUOTE_TYPE_LABEL, type QuoteType } from "@/lib/quotes";
import { requireCompany } from "@/lib/session";

export default async function CotizacionesPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "quote.create", session.activeCompanyCode) && !can(session.role, "quote.price", session.activeCompanyCode) && !can(session.role, "quote.follow", session.activeCompanyCode)) {
    redirect("/inicio");
  }
  const { vista } = await searchParams;
  const pending = vista === "pendientes";
  const quotes = await prisma.quote.findMany({
    where: {
      companyId: session.activeCompanyId,
      ...(pending ? { status: "PENDIENTE_COTIZAR" } : {}),
      ...(session.role === "VENTAS" ? { sellerUserId: session.userId } : {}),
    },
    include: { client: true, lines: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const cases = pending && can(session.role, "quote.price", session.activeCompanyCode)
    ? await prisma.technicalCase.findMany({
        where: { serviceCompanyId: session.activeCompanyId, quotePending: true, NOT: { id: { in: (await prisma.quote.findMany({ where: { technicalCaseId: { not: null }, companyId: session.activeCompanyId }, select: { technicalCaseId: true } })).map((row) => row.technicalCaseId).filter((id): id is string => Boolean(id)) } } },
        include: { equipment: true },
        take: 50,
      })
    : [];
  return (
    <>
      <PageHeader
        title={pending ? "Pendientes de cotizar" : "Cotizaciones"}
        subtitle="Una sola bandeja para lo que necesita precio. El vendedor no fija el precio."
        action={can(session.role, "quote.create", session.activeCompanyCode) ? <Link href="/cotizaciones/nuevo" className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Nueva cotización</Link> : null}
      />
      <div className="mb-4 flex gap-2">
        <Link href="/cotizaciones" className={`rounded-md px-3 py-2 text-sm ${pending ? "border border-[var(--line)] bg-white" : "bg-[var(--accent)] text-white"}`}>Todas</Link>
        <Link href="/cotizaciones?vista=pendientes" className={`rounded-md px-3 py-2 text-sm ${pending ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white"}`}>Pendientes de cotizar</Link>
      </div>
      {cases.length > 0 ? (
        <ul className="mb-4 divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-white">
          {cases.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{row.folio} · {row.equipment.folio} aún no tiene cotización</span>
              <Link href={`/operacion/${row.id}`} className="text-[var(--accent)]">Abrir operación</Link>
            </li>
          ))}
        </ul>
      ) : null}
      {quotes.length === 0 ? <Empty title="Sin cotizaciones" body="Una cotización nace del vendedor o de una operación que ya puede tener precio." /> : (
        <Table>
          <thead><tr><Th>Folio</Th><Th>Cliente</Th><Th>Tipo</Th><Th>Estado</Th><Th>Total</Th></tr></thead>
          <tbody>
            {quotes.map((quote) => {
              const hidePrice = session.role === "VENTAS" && quote.status === "PENDIENTE_COTIZAR";
              const totals = hidePrice ? null : quoteTotals(quote.lines, quote.discountPct);
              return (
                <tr key={quote.id}>
                  <Td><Link href={`/cotizaciones/${quote.id}`} className="font-medium text-[var(--accent)]">{quote.folio}</Link></Td>
                  <Td>{quote.client.isSystem ? "SYSTRON · intercompañía" : quote.client.name}</Td>
                  <Td>{QUOTE_TYPE_LABEL[quote.quoteType as QuoteType] ?? quote.quoteType}</Td>
                  <Td><Badge>{QUOTE_STATUS_LABEL[quote.status] ?? quote.status}</Badge></Td>
                  <Td>{money(totals?.total)}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
