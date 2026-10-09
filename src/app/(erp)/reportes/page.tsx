import { redirect } from "next/navigation";
import { ActiveFilters, Button, Card, controlClass, Empty, Field, FilterBar, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, TextLink, Th } from "@/components/ui";
import { listHref } from "@/lib/list-url";
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
      <FilterBar action={`/reportes/${tipo}`}>
        <Field label="Desde"><input name="desde" type="date" defaultValue={desde} className={controlClass} /></Field>
        <Field label="Hasta"><input name="hasta" type="date" defaultValue={hasta} className={controlClass} /></Field>
        <Button type="submit" tone="ghost">Filtrar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(desde ? [{ label: `Desde ${desde}`, clearHref: listHref(`/reportes/${tipo}`, { hasta }) }] : []),
          ...(hasta ? [{ label: `Hasta ${hasta}`, clearHref: listHref(`/reportes/${tipo}`, { desde }) }] : []),
        ]}
      />
      <ResponsiveData
        table={
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
        }
        cards={table.rows.map((row, index) => {
          const title = String(row.cells[0] ?? `Fila ${index + 1}`);
          const href = "href" in row && row.href ? row.href : null;
          const detail = row.cells.slice(1).join(" · ");
          if (href) {
            return <MobileCard key={index} href={href} title={title}><p>{detail}</p></MobileCard>;
          }
          return (
            <article key={index} className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
              <p className="font-medium">{title}</p>
              <p className="mt-2 text-[var(--muted)]">{detail}</p>
            </article>
          );
        })}
      />
    </>
  );
}
