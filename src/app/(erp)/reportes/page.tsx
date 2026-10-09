import { redirect } from "next/navigation";
import { PageHeader, RecordLink, Table, Td, TextLink, Th } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { reportTable, visibleReports } from "@/lib/reports";
import type { Role } from "@/lib/roles";
import { requireCompany } from "@/lib/session";

export default async function ReportesPage() {
  const session = await requireCompany();
  if (!can(session.role, "report.view", session.activeCompanyCode)) redirect("/inicio");
  const reports = visibleReports(session.role as Role);
  return (
    <>
      <PageHeader title="Reportes" subtitle={`${session.activeCompanyName}. La consulta no mezcla empresas ni crea registros.`} />
      <ul className="space-y-2">
        {reports.map((report) => <li key={report.id}><RecordLink href={`/reportes/${report.id}`}>{report.label}</RecordLink></li>)}
      </ul>
    </>
  );
}

export async function ReportView({ params, searchParams }: { params: Promise<{ tipo: string }>; searchParams: Promise<{ desde?: string; hasta?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "report.view", session.activeCompanyCode)) redirect("/inicio");
  const { tipo } = await params;
  const allowed = visibleReports(session.role as Role).some((report) => report.id === tipo);
  if (!allowed) redirect("/reportes");
  const { desde, hasta } = await searchParams;
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  const table = await reportTable(session.activeCompanyId, Boolean(company?.inventoryEnabled) || session.activeCompanyCode === "SYSTRON", tipo, desde ?? null, hasta ?? null);
  const query = new URLSearchParams();
  if (desde) query.set("desde", desde);
  if (hasta) query.set("hasta", hasta);
  return (
    <>
      <PageHeader back={{ href: "/reportes", label: "Reportes" }} title={table.title} subtitle="El folio abre el registro real." action={<TextLink href={`/reportes/${tipo}/csv?${query.toString()}`}>Descargar CSV</TextLink>} />
      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label>Desde <input name="desde" type="date" defaultValue={desde} className="rounded-md border border-[var(--line)] px-2 py-2" /></label>
        <label>Hasta <input name="hasta" type="date" defaultValue={hasta} className="rounded-md border border-[var(--line)] px-2 py-2" /></label>
        <button className="rounded-md border border-[var(--line)] px-3 py-2">Filtrar</button>
      </form>
      <Table>
        <thead><tr>{table.headers.map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={index}>
              {row.cells.map((cell, cellIndex) => <Td key={cellIndex}>{cellIndex === 0 && "href" in row && row.href ? <RecordLink href={row.href}>{cell}</RecordLink> : cell}</Td>)}
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
