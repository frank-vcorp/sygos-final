import { redirect } from "next/navigation";
import { overtimeReviewAction } from "../actions";
import { RequestOvertimeModal } from "./request-overtime-modal";
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
import { listHref } from "@/lib/list-url";
import { can } from "@/lib/permissions";
import { mexicoToday } from "@/lib/personnel";
import { requireCompany } from "@/lib/session";

export default async function HorasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; periodo?: string }>;
}) {
  const session = await requireCompany();
  const canAccessHoras =
    can(session.role, "overtime.capture", session.activeCompanyCode) ||
    can(session.role, "personnel.authorize") ||
    can(session.role, "personnel.manage");
  if (!canAccessHoras) redirect("/inicio");

  const params = await searchParams;
  const estadoFilter = (params.estado ?? "TODOS").toUpperCase();
  const periodoFilter = (params.periodo ?? "").trim();

  const isCeo = can(session.role, "personnel.authorize");
  const isHr = can(session.role, "personnel.manage");

  const mine =
    isCeo || isHr
      ? await prisma.collaborator.findMany({
          where: { companyId: session.activeCompanyId, status: "ACTIVO", exemptBenefits: false },
          include: { user: true },
          orderBy: { user: { name: "asc" } },
        })
      : session.role === "GERENTE_OPERATIVO_SERVOMOTORES"
        ? await prisma.collaborator.findMany({
            where: {
              companyId: session.activeCompanyId,
              status: "ACTIVO",
              user: { role: "AYUDANTE_GENERAL" },
            },
            include: { user: true },
            orderBy: { user: { name: "asc" } },
          })
        : await prisma.collaborator.findMany({
            where: {
              companyId: session.activeCompanyId,
              status: "ACTIVO",
              exemptBenefits: false,
              OR: [{ userId: session.userId }, { bossUserId: session.userId }],
            },
            include: { user: true },
            orderBy: { user: { name: "asc" } },
          });

  const allowedIds = mine.map((m) => m.id);

  const allRequests = await prisma.overtimeRequest.findMany({
    where: {
      collaborator: {
        companyId: session.activeCompanyId,
        ...(isCeo || isHr ? {} : { id: { in: allowedIds } }),
      },
    },
    include: {
      collaborator: { include: { user: true } },
      requestedBy: true,
      authorizedBy: true,
    },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  const rows = allRequests.filter((row) => {
    const isPending = row.status === "PENDIENTE_CEO" || row.status === "PENDIENTE_JEFE";
    const isAuthorized = row.status === "AUTORIZADA" || row.status === "PAGADA";
    const normalized = isPending ? "PENDIENTE" : isAuthorized ? "AUTORIZADA" : "RECHAZADA";
    if (estadoFilter !== "TODOS" && normalized !== estadoFilter) return false;
    if (periodoFilter && !row.workDate.startsWith(periodoFilter)) return false;
    return true;
  });

  const filterChips: Array<{ label: string; clearHref: string }> = [];
  if (estadoFilter !== "TODOS") {
    filterChips.push({
      label: `Estado: ${estadoFilter === "PENDIENTE" ? "Pendiente" : estadoFilter === "AUTORIZADA" ? "Autorizada" : "Rechazada"}`,
      clearHref: listHref("/personal/horas", { periodo: periodoFilter || undefined }),
    });
  }
  if (periodoFilter) {
    filterChips.push({
      label: `Periodo: ${periodoFilter}`,
      clearHref: listHref("/personal/horas", { estado: estadoFilter !== "TODOS" ? estadoFilter : undefined }),
    });
  }

  return (
    <>
      <PageHeader
        title="Horas extra"
        subtitle="Solicita y consulta horas extra. El sistema clasifica las horas automáticamente según las reglas vigentes."
        action={
          <RequestOvertimeModal
            collaborators={mine.map((m) => ({ id: m.id, name: m.user.name }))}
            today={mexicoToday()}
          />
        }
      />

      <FilterBar action="/personal/horas">
        <select name="estado" defaultValue={estadoFilter} aria-label="Estado">
          <option value="TODOS">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="AUTORIZADA">Autorizadas</option>
          <option value="RECHAZADA">Rechazadas</option>
        </select>
        <input
          name="periodo"
          type="month"
          defaultValue={periodoFilter}
          aria-label="Periodo"
        />
        <Button type="submit" tone="ghost" className="min-h-8 rounded-full px-3 py-1 text-xs">
          Filtrar
        </Button>
      </FilterBar>

      <ActiveFilters items={filterChips} />

      {rows.length === 0 ? (
        <Empty
          title="Sin solicitudes de horas extra"
          body="No hay solicitudes de horas extra registradas con estos filtros."
        />
      ) : (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Fecha trabajada</Th>
                  <Th>Colaborador</Th>
                  <Th>Horas solicitadas</Th>
                  <Th>Horas autorizadas</Th>
                  <Th>Motivo</Th>
                  <Th>Estado</Th>
                  <Th>Quién solicitó</Th>
                  <Th>Quién autorizó</Th>
                  {isCeo ? <Th>Acciones</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isPending = row.status === "PENDIENTE_CEO" || row.status === "PENDIENTE_JEFE";
                  const isAuthorized = row.status === "AUTORIZADA" || row.status === "PAGADA";
                  return (
                    <tr key={row.id}>
                      <Td>{row.workDate}</Td>
                      <Td>
                        {isCeo || isHr ? (
                          <RecordLink href={`/personal/colaboradores/${row.collaboratorId}?tab=solicitudes&subtab=horas`}>
                            {row.collaborator.user.name}
                          </RecordLink>
                        ) : (
                          <span className="font-semibold text-slate-900">{row.collaborator.user.name}</span>
                        )}
                      </Td>
                      <Td>{row.hours} h</Td>
                      <Td>
                        {row.authorizedHours != null
                          ? `${row.authorizedHours} h`
                          : isAuthorized
                            ? `${row.hours} h`
                            : "—"}
                      </Td>
                      <Td>{row.reason}</Td>
                      <Td>
                        <Badge tone={isAuthorized ? "ok" : row.status === "RECHAZADA" ? "danger" : "warn"}>
                          {isAuthorized ? "Autorizada" : row.status === "RECHAZADA" ? "Rechazada" : "Pendiente"}
                        </Badge>
                      </Td>
                      <Td>{row.requestedBy?.name ?? "—"}</Td>
                      <Td>{row.authorizedBy?.name ?? "—"}</Td>
                      {isCeo ? (
                        <Td>
                          {isPending ? (
                            <form action={overtimeReviewAction} className="flex flex-wrap items-center gap-1.5">
                              <input type="hidden" name="overtimeId" value={row.id} />
                              <input type="hidden" name="version" value={row.version} />
                              <input
                                name="authorizedHours"
                                type="number"
                                step="0.5"
                                min="0.5"
                                defaultValue={row.hours}
                                aria-label="Horas autorizadas"
                                className="min-h-8 w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                              />
                              <Button type="submit" name="decision" value="si" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                                Autorizar
                              </Button>
                              <Button type="submit" name="decision" value="no" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                                Rechazar
                              </Button>
                            </form>
                          ) : (
                            "—"
                          )}
                        </Td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={rows.map((row) => {
            const isPending = row.status === "PENDIENTE_CEO" || row.status === "PENDIENTE_JEFE";
            const isAuthorized = row.status === "AUTORIZADA" || row.status === "PAGADA";
            return (
              <MobileCard
                key={row.id}
                href={isCeo || isHr ? `/personal/colaboradores/${row.collaboratorId}?tab=solicitudes&subtab=horas` : undefined}
                title={row.collaborator.user.name}
                meta={
                  <Badge tone={isAuthorized ? "ok" : row.status === "RECHAZADA" ? "danger" : "warn"}>
                    {isAuthorized ? "Autorizada" : row.status === "RECHAZADA" ? "Rechazada" : "Pendiente"}
                  </Badge>
                }
                footer={
                  isCeo && isPending ? (
                    <form action={overtimeReviewAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="overtimeId" value={row.id} />
                      <input type="hidden" name="version" value={row.version} />
                      <input
                        name="authorizedHours"
                        type="number"
                        step="0.5"
                        min="0.5"
                        defaultValue={row.hours}
                        aria-label="Horas autorizadas"
                        className="min-h-8 w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                      />
                      <Button type="submit" name="decision" value="si" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                        Autorizar
                      </Button>
                      <Button type="submit" name="decision" value="no" tone="ghost" className="min-h-8 px-2.5 py-1 text-xs">
                        Rechazar
                      </Button>
                    </form>
                  ) : undefined
                }
              >
                <p>
                  Fecha: {row.workDate} · Solicitadas: {row.hours} h · Autorizadas:{" "}
                  {row.authorizedHours != null ? `${row.authorizedHours} h` : isAuthorized ? `${row.hours} h` : "—"}
                </p>
                <p className="mt-1">Motivo: {row.reason}</p>
              </MobileCard>
            );
          })}
        />
      )}
    </>
  );
}
