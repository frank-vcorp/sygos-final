import { redirect } from "next/navigation";
import { Empty, KpiCard, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, TextLink, Th } from "@/components/ui";
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
      {rows.length === 0 ? (
        <Empty title="Sin producción en el periodo" body="Aparece cuando hay diagnósticos o reparaciones validados." />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Técnico</Th>
                  <Th>Trabajos</Th>
                  <Th>Valor</Th>
                  <Th>Efectividad</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <Td><RecordLink href="/reportes/produccion">{row.name}</RecordLink></Td>
                    <Td>{row.jobs} · {row.diagnoses} diag. · {row.repairs} rep.</Td>
                    <Td>{money(row.value)}</Td>
                    <Td>{row.effectiveness == null ? "—" : `${Math.round(row.effectiveness * 100)}%`}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => (
            <MobileCard key={row.userId} href="/reportes/produccion" title={row.name}>
              <p>{row.jobs} trabajos · {row.diagnoses} diagnósticos · {row.repairs} reparaciones · {row.warranties} garantías</p>
              <p className="mt-1 font-medium">{money(row.value)}</p>
              <p className="mt-1 text-[var(--muted)]">
                Efectividad {row.effectiveness == null ? "sin reparaciones de origen" : `${Math.round(row.effectiveness * 100)}%`}
              </p>
            </MobileCard>
          ))}
        />
      )}
    </>
  );
}
