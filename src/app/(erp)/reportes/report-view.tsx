import { redirect } from "next/navigation";
import { ActiveFilters, Button, controlClass, Field, FilterBar, MobileCard, PageHeader, RecordLink, ResponsiveData, Table, Td, TextLink, Th } from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { reportTable, visibleReports } from "@/lib/reports";
import type { Role } from "@/lib/roles";
import { requireCompany } from "@/lib/session";

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
                  {row.cells.map((cell, cellIndex) => (
                    <Td key={cellIndex}>
                      {cellIndex === 0 && "href" in row && row.href ? (
                        <RecordLink href={row.href}>{cell}</RecordLink>
                      ) : cellIndex === 1 && "clientHref" in row && row.clientHref ? (
                        <TextLink href={row.clientHref}>{cell}</TextLink>
                      ) : (
                        cell
                      )}
                    </Td>
                  ))}
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
          return <MobileCard key={index} title={title}><p>{detail}</p></MobileCard>;
        })}
      />
    </>
  );
}
