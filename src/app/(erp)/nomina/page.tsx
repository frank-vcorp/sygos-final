import { redirect } from "next/navigation";
import { GeneratePayrollModal } from "./generate-payroll-modal";
import {
  ActiveFilters,
  Badge,
  Button,
  Empty,
  FilterBar,
  MobileCard,
  PageHeader,
  RecordLink,
  ResponsiveData,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { coordPageSubtitle, coordPageTitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { prisma } from "@/lib/db";
import { listHref } from "@/lib/list-url";
import { money, roundMoney } from "@/lib/money";
import {
  isoWeekFromDate,
  payrollStatusLabel,
  payrollStatusTone,
} from "@/lib/payroll";
import { can } from "@/lib/permissions";
import { mexicoToday } from "@/lib/personnel";
import { requireCompany } from "@/lib/session";

function normalizeStatusFilter(status: string): string {
  if (status === "PRELIMINAR") return "EN_PREPARACION";
  if (status === "AUTORIZADA") return "CERRADA";
  return status;
}

export default async function NominaPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; estado?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage") && !can(session.role, "personnel.authorize")) {
    redirect("/inicio");
  }
  const params = await searchParams;
  const periodoFilter = (params.periodo ?? "").trim().toLowerCase();
  const estadoFilter = (params.estado ?? "TODOS").toUpperCase();

  const allRows = await prisma.payrollPeriod.findMany({
    where: { companyId: session.activeCompanyId },
    include: { lines: true },
    orderBy: [{ year: "desc" }, { weekNumber: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const rows = allRows.filter((row) => {
    const normalizedStatus = normalizeStatusFilter(row.status);
    if (estadoFilter !== "TODOS" && normalizedStatus !== estadoFilter) return false;
    if (periodoFilter) {
      const label = (row.periodLabel || `${row.periodStart} a ${row.periodEnd}`).toLowerCase();
      const folio = row.folio.toLowerCase();
      if (
        !label.includes(periodoFilter) &&
        !folio.includes(periodoFilter) &&
        !row.periodStart.toLowerCase().includes(periodoFilter) &&
        !row.periodEnd.toLowerCase().includes(periodoFilter)
      ) {
        return false;
      }
    }
    return true;
  });

  const today = mexicoToday();
  const currentIsoWeek = isoWeekFromDate(today);
  const sidebarNav = coordUsesSidebarNav(session.role);

  const filterChips: Array<{ label: string; clearHref: string }> = [];
  if (periodoFilter) {
    filterChips.push({
      label: `Periodo: ${params.periodo}`,
      clearHref: listHref("/nomina", { estado: estadoFilter !== "TODOS" ? estadoFilter : undefined }),
    });
  }
  if (estadoFilter !== "TODOS") {
    filterChips.push({
      label: `Estado: ${payrollStatusLabel(estadoFilter)}`,
      clearHref: listHref("/nomina", { periodo: params.periodo || undefined }),
    });
  }

  return (
    <>
      <PageHeader
        title={coordPageTitle(sidebarNav, "Nómina", "Nómina")}
        subtitle={coordPageSubtitle(
          sidebarNav,
          session.activeCompanyCode,
          `${session.activeCompanyName} · Administración, validación y cierre de nóminas de la empresa activa.`,
          "Nóminas de la empresa",
        )}
        action={
          <GeneratePayrollModal
            companyCode={session.activeCompanyCode}
            defaultIsoWeek={currentIsoWeek.isoWeekString}
            defaultPaymentDate={today}
          />
        }
      />

      <FilterBar action="/nomina">
        <input
          name="periodo"
          defaultValue={params.periodo ?? ""}
          placeholder="Filtrar por periodo o semana (ej. S44, 2026-10)…"
          aria-label="Periodo"
        />
        <select name="estado" defaultValue={estadoFilter} aria-label="Estado">
          <option value="TODOS">Todos los estados</option>
          <option value="EN_PREPARACION">En preparación</option>
          <option value="PENDIENTE_VALIDACION">Pendiente de validación</option>
          <option value="EN_CORRECCION">En corrección</option>
          <option value="CERRADA">Cerrada</option>
        </select>
        <Button type="submit" tone="ghost" className="min-h-8 rounded-full px-3 py-1 text-xs">
          Filtrar
        </Button>
      </FilterBar>

      <ActiveFilters items={filterChips} />

      {rows.length === 0 ? (
        <Empty
          title="Sin nóminas registradas"
          body="Genera la nómina semanal para calcular percepciones y descuentos de los colaboradores activos."
        />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Folio</Th>
                  <Th>Periodo</Th>
                  <Th>Fecha de pago</Th>
                  <Th>Número de colaboradores</Th>
                  <Th>Total</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const total = roundMoney(
                    row.lines.reduce(
                      (sum, line) =>
                        sum + (line.totalPagar !== 0 ? line.totalPagar : line.transferTotal + line.cashTotal),
                      0,
                    ),
                  );
                  const periodDisplay =
                    row.periodLabel || `${row.periodStart} a ${row.periodEnd}`;
                  const paymentDisplay = row.paymentDate || row.periodEnd;
                  return (
                    <tr key={row.id}>
                      <Td>
                        <RecordLink href={`/nomina/${row.id}`}>{row.folio}</RecordLink>
                      </Td>
                      <Td>{periodDisplay}</Td>
                      <Td>{paymentDisplay}</Td>
                      <Td>{row.lines.length}</Td>
                      <Td className="font-semibold text-slate-900 tabular-nums">{money(total)}</Td>
                      <Td>
                        <Badge tone={payrollStatusTone(row.status)}>
                          {payrollStatusLabel(row.status)}
                        </Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => {
            const total = roundMoney(
              row.lines.reduce(
                (sum, line) =>
                  sum + (line.totalPagar !== 0 ? line.totalPagar : line.transferTotal + line.cashTotal),
                0,
              ),
            );
            const periodDisplay =
              row.periodLabel || `${row.periodStart} a ${row.periodEnd}`;
            const paymentDisplay = row.paymentDate || row.periodEnd;
            return (
              <MobileCard
                key={row.id}
                href={`/nomina/${row.id}`}
                title={row.folio}
                meta={
                  <Badge tone={payrollStatusTone(row.status)}>
                    {payrollStatusLabel(row.status)}
                  </Badge>
                }
              >
                <p>{periodDisplay}</p>
                <p className="mt-1">
                  Pago: {paymentDisplay} · Colaboradores: {row.lines.length} · Total:{" "}
                  <strong>{money(total)}</strong>
                </p>
              </MobileCard>
            );
          })}
        />
      )}
    </>
  );
}
