import { redirect } from "next/navigation";
import { KpiCard, PageHeader, RecordLink, TextLink } from "@/components/ui";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { productionForCompany } from "@/lib/reports";
import { averageTicket } from "@/lib/panels";
import { requireCompany } from "@/lib/session";

export default async function ProduccionPage() {
  const session = await requireCompany();
  if (!can(session.role, "production.view", session.activeCompanyCode)) redirect("/inicio");
  const rows = await productionForCompany(session.activeCompanyId);
  const value = rows.reduce((sum, row) => sum + row.value, 0);
  const jobs = rows.reduce((sum, row) => sum + row.jobs, 0);
  const billable = rows.reduce((sum, row) => sum + row.repairs + row.diagnoses, 0);
  return (
    <>
      <PageHeader
        title="Producción técnica"
        subtitle={`${session.activeCompanyName}. El valor se atribuye a quien dejó el resultado validado.`}
        action={<TextLink href="/reportes/produccion">Reporte detallado</TextLink>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Trabajos validados" value={String(jobs)} />
        <KpiCard label="Valor producido" value={money(value)} />
        <KpiCard label="Ticket promedio" value={money(averageTicket(value, billable))} />
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.userId} className="rounded-lg border border-[var(--line)] bg-white p-4">
            <RecordLink href="/reportes/produccion">{row.name}</RecordLink>
            <p className="mt-1">{row.jobs} trabajos · {row.diagnoses} diagnósticos · {row.repairs} reparaciones · {row.warranties} garantías · {money(row.value)}</p>
            <p className="text-[var(--muted)]">Efectividad {row.effectiveness == null ? "sin reparaciones de origen" : `${Math.round(row.effectiveness * 100)}%`}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
