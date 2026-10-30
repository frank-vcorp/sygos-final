import { redirect } from "next/navigation";
import { NewCollaboratorModal } from "./new-collaborator-modal";
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
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { listHref } from "@/lib/list-url";
import { coordPageSubtitle, coordPageTitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { can } from "@/lib/permissions";
import { collaboratorDisplayStatus, filterCollaborators, mexicoToday } from "@/lib/personnel";
import { ROLE_LABEL, isRole } from "@/lib/roles";
import { requireCompany } from "@/lib/session";

function formatCollaboratorJob(jobTitle: string | null, role: string): string {
  if (jobTitle && jobTitle.trim()) return jobTitle.trim();
  return isRole(role) ? ROLE_LABEL[role] : role;
}

export default async function PersonalPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; puesto?: string; nuevo?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage") && !can(session.role, "personnel.authorize")) {
    redirect("/inicio");
  }
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const estado = (params.estado ?? "ACTIVOS").toUpperCase();
  const puesto = (params.puesto ?? "").trim();
  const isCeo = can(session.role, "personnel.authorize");

  const [allRows, availableUsers, bosses] = await Promise.all([
    prisma.collaborator.findMany({
      where: { companyId: session.activeCompanyId },
      include: { user: true, boss: true },
      orderBy: { user: { name: "asc" } },
    }),
    isCeo
      ? prisma.user.findMany({
          where: {
            companyId: session.activeCompanyId,
            active: true,
            collaborator: null,
            role: { not: "KIOSCO_ASISTENCIA" },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    isCeo
      ? prisma.user.findMany({
          where: {
            active: true,
            OR: [{ companyId: session.activeCompanyId }, { companyId: null }],
            role: {
              in: [
                "CEO",
                "GERENTE_OPERATIVO_SYSTRON",
                "GERENTE_OPERATIVO_SERVOMOTORES",
                "SUPERVISOR_TECNICO",
                "COORDINACION_ADMINISTRACION",
              ],
            },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const puestos = Array.from(
    new Set(allRows.map((row) => formatCollaboratorJob(row.jobTitle, row.user.role))),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const rows = filterCollaborators(
    allRows.map((row) => ({
      ...row,
      jobTitle: formatCollaboratorJob(row.jobTitle, row.user.role),
    })),
    { q, estado, puesto },
  );

  const sidebarNav = coordUsesSidebarNav(session.role);
  const filterChips: Array<{ label: string; clearHref: string }> = [];
  if (q) {
    filterChips.push({
      label: `Búsqueda: ${q}`,
      clearHref: listHref("/personal", { estado: estado !== "ACTIVOS" ? estado : undefined, puesto: puesto || undefined }),
    });
  }
  if (estado !== "ACTIVOS") {
    filterChips.push({
      label: `Estado: ${estado === "INACTIVOS" ? "Inactivos" : "Todos"}`,
      clearHref: listHref("/personal", { q: q || undefined, puesto: puesto || undefined }),
    });
  }
  if (puesto) {
    filterChips.push({
      label: `Puesto: ${puesto}`,
      clearHref: listHref("/personal", { q: q || undefined, estado: estado !== "ACTIVOS" ? estado : undefined }),
    });
  }

  return (
    <>
      <PageHeader
        title={coordPageTitle(sidebarNav, "Colaboradores", "Colaboradores")}
        subtitle={coordPageSubtitle(
          sidebarNav,
          session.activeCompanyCode,
          "Consulta y administra los colaboradores de la empresa activa.",
          "Colaboradores de la empresa",
        )}
        action={
          isCeo ? (
            <NewCollaboratorModal
              users={availableUsers}
              bosses={bosses}
              defaultOpen={params.nuevo === "1"}
              today={mexicoToday()}
            />
          ) : null
        }
      />

      <FilterBar action="/personal">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre…"
          aria-label="Buscar por nombre"
        />
        <select name="estado" defaultValue={estado} aria-label="Estado">
          <option value="ACTIVOS">Activos</option>
          <option value="INACTIVOS">Inactivos</option>
          <option value="TODOS">Todos</option>
        </select>
        <select name="puesto" defaultValue={puesto} aria-label="Puesto">
          <option value="">Todos los puestos</option>
          {puestos.map((job) => (
            <option key={job} value={job}>
              {job}
            </option>
          ))}
        </select>
        <Button type="submit" tone="ghost" className="min-h-8 rounded-full px-3 py-1 text-xs">
          Filtrar
        </Button>
      </FilterBar>

      <ActiveFilters items={filterChips} />

      {rows.length === 0 ? (
        <Empty
          title="Sin colaboradores"
          body="No se encontraron colaboradores con los filtros seleccionados."
        />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Colaborador</Th>
                  <Th>Puesto</Th>
                  <Th>Jefe directo</Th>
                  <Th>Fecha de ingreso</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isActive = collaboratorDisplayStatus(row.status) === "ACTIVO";
                  return (
                    <tr key={row.id}>
                      <Td>
                        <RecordLink href={`/personal/colaboradores/${row.id}`}>
                          {row.user.name}
                        </RecordLink>
                      </Td>
                      <Td>{row.jobTitle}</Td>
                      <Td>{row.boss?.name ?? "—"}</Td>
                      <Td>{formatWhen(row.hiredAt)}</Td>
                      <Td>
                        <Badge tone={isActive ? "ok" : "warn"}>
                          {isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => {
            const isActive = collaboratorDisplayStatus(row.status) === "ACTIVO";
            return (
              <MobileCard
                key={row.id}
                href={`/personal/colaboradores/${row.id}`}
                title={row.user.name}
                meta={
                  <Badge tone={isActive ? "ok" : "warn"}>
                    {isActive ? "Activo" : "Inactivo"}
                  </Badge>
                }
              >
                <p>
                  {row.jobTitle} · Jefe directo: {row.boss?.name ?? "—"}
                </p>
                <p className="mt-1">Fecha de ingreso: {formatWhen(row.hiredAt)}</p>
              </MobileCard>
            );
          })}
        />
      )}
    </>
  );
}
