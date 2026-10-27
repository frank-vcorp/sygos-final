import { redirect } from "next/navigation";
import { Card, Empty, PageHeader, RecordLink } from "@/components/ui";
import { can } from "@/lib/permissions";
import { visibleReports } from "@/lib/reports";
import type { Role } from "@/lib/roles";
import { requireCompany } from "@/lib/session";

export default async function ReportesPage() {
  const session = await requireCompany();
  if (!can(session.role, "report.view", session.activeCompanyCode)) redirect("/inicio");
  const reports = visibleReports(session.role as Role);
  return (
    <>
      <PageHeader title="Reportes" subtitle={`${session.activeCompanyName}. La consulta no mezcla empresas ni crea registros.`} />
      {reports.length === 0 ? (
        <Empty title="Sin reportes" body="Tu rol no tiene reportes asignados en esta empresa." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {reports.map((report) => (
            <li key={report.id}>
              <Card className="flex h-full flex-col justify-between p-4">
                <RecordLink href={`/reportes/${report.id}`} className="text-base">{report.label}</RecordLink>
                <p className="mt-2 text-xs text-[var(--muted)]">Consulta solo lectura · abre el detalle del folio desde la tabla.</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
