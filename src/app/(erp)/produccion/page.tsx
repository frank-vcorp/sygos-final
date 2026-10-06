import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
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
  return (
    <>
      <PageHeader title="Producción técnica" subtitle={`${session.activeCompanyName}. El valor se atribuye a quien dejó el resultado validado. Una garantía no suma ticket y el trabajo externo no asigna valor individual.`} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card label="Trabajos validados" value={String(jobs)} />
        <Card label="Valor producido" value={money(value)} />
        <Card label="Ticket promedio" value={money(averageTicket(value, rows.reduce((sum, row) => sum + row.repairs + row.diagnoses, 0)))} />
      </div>
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.userId} className="rounded-lg border border-[var(--line)] bg-white p-4">
            <Link href={`/reportes/produccion`} className="font-medium text-[var(--accent)]">{row.name}</Link>
            <p className="mt-1">{row.jobs} trabajos · {row.diagnoses} diagnósticos · {row.repairs} reparaciones · {row.warranties} garantías · {money(row.value)}</p>
            <p>Efectividad {row.effectiveness == null ? "sin reparaciones de origen" : `${Math.round(row.effectiveness * 100)}%`}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return <section className="rounded-lg border border-[var(--line)] bg-white p-4"><p className="text-sm text-[var(--muted)]">{label}</p><p className="text-xl font-medium">{value}</p></section>;
}
