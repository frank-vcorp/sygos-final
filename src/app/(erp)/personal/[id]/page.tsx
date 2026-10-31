import { notFound, redirect } from "next/navigation";
import { CollaboratorAsistenciaTab } from "./collaborator-asistencia-tab";
import { CollaboratorDatosTab } from "./collaborator-datos-tab";
import { CollaboratorDocumentosTab } from "./collaborator-documentos-tab";
import { CollaboratorSolicitudesTab } from "./collaborator-solicitudes-tab";
import { CollaboratorStatusMenu } from "./collaborator-status-menu";
import { Badge, EntityDetailHeader, SegmentedNav } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { can } from "@/lib/permissions";
import {
  collaboratorDisplayStatus,
  hireKindLabel,
  mexicoToday,
  parseActivities,
  parseCommissionTiers,
  weekdaysBetween,
} from "@/lib/personnel";
import { companiesForRole, ROLE_LABEL, ROLES, isRole, type Role } from "@/lib/roles";
import { requireCompany } from "@/lib/session";

function formatTimeMexico(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatCollaboratorJob(jobTitle: string | null, role: string): string {
  if (jobTitle && jobTitle.trim()) return jobTitle.trim();
  return isRole(role) ? ROLE_LABEL[role] : role;
}

function roleAvailableForCollaborator(role: Role, companyCode: string): boolean {
  if (role === "ADMINISTRADOR" || role === "CEO" || role === "KIOSCO_ASISTENCIA") return false;
  const allowed = companiesForRole(role);
  if (allowed === "both") return true;
  return allowed.includes(companyCode as "SYSTRON" | "SERVOMOTORES");
}

export default async function ColaboradorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; subtab?: string; creado?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "personnel.manage") && !can(session.role, "personnel.authorize")) {
    redirect("/inicio");
  }
  const { id } = await params;
  const query = await searchParams;
  const activeTab =
    query.tab === "asistencia" || query.tab === "solicitudes" || query.tab === "documentos"
      ? query.tab
      : "datos";

  const row = await prisma.collaborator.findFirst({
    where: { id, companyId: session.activeCompanyId },
    include: {
      user: true,
      boss: true,
      vacations: {
        include: { requestedBy: true, decidedBy: true },
        orderBy: { createdAt: "desc" },
      },
      attendance: { orderBy: { workDate: "desc" }, take: 90 },
      overtime: {
        include: { requestedBy: true, authorizedBy: true },
        orderBy: { createdAt: "desc" },
      },
      compensations: {
        include: { requestedBy: true, decidedBy: true },
        orderBy: { createdAt: "desc" },
      },
      leavePermissions: {
        include: { requestedBy: true, decidedBy: true },
        orderBy: { createdAt: "desc" },
      },
      documents: { orderBy: { createdAt: "desc" } },
      payrollLines: {
        include: { period: true },
        orderBy: { period: { createdAt: "desc" } },
        take: 6,
      },
    },
  });
  if (!row) notFound();

  const bosses = await prisma.user.findMany({
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
  });

  const isCeo = can(session.role, "personnel.authorize");
  const isActive = collaboratorDisplayStatus(row.status) === "ACTIVO";
  const jobLabel = formatCollaboratorJob(row.jobTitle, row.user.role);
  const roleLabel = isRole(row.user.role) ? ROLE_LABEL[row.user.role] : row.user.role;
  const today = mexicoToday();
  const currentTime = formatTimeMexico(new Date()) ?? "09:00";
  const hasClosedProcesses = row.payrollLines.some(
    (line) => line.period.status === "AUTORIZADA" || line.period.status === "CERRADA",
  );

  const availableRoles = ROLES.filter((r) =>
    roleAvailableForCollaborator(r, session.activeCompanyCode),
  ).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

  const baseHref = `/personal/colaboradores/${row.id}`;

  return (
    <>
      <EntityDetailHeader
        back={{ href: "/personal", label: "Colaboradores" }}
        title={row.user.name}
        subtitle={jobLabel}
        status={<Badge tone={isActive ? "ok" : "warn"}>{isActive ? "Activo" : "Inactivo"}</Badge>}
        secondaryActions={
          isCeo ? (
            <CollaboratorStatusMenu
              collaboratorId={row.id}
              collaboratorName={row.user.name}
              version={row.version}
              isActive={isActive}
            />
          ) : null
        }
      />

      <SegmentedNav
        items={[
          { href: baseHref, label: "Datos", active: activeTab === "datos" },
          { href: `${baseHref}?tab=asistencia`, label: "Asistencia", active: activeTab === "asistencia" },
          { href: `${baseHref}?tab=solicitudes`, label: "Solicitudes", active: activeTab === "solicitudes" },
          { href: `${baseHref}?tab=documentos`, label: "Documentos", active: activeTab === "documentos" },
        ]}
      />

      {activeTab === "datos" ? (
        <CollaboratorDatosTab
          isCeo={isCeo}
          companyName={session.activeCompanyName}
          justCreated={query.creado === "1"}
          bosses={bosses.map((b) => ({ id: b.id, name: b.name }))}
          roles={availableRoles}
          collaborator={{
            id: row.id,
            version: row.version,
            name: row.user.name,
            username: row.user.username,
            role: row.user.role,
            roleLabel,
            credentialPasswordPreview: row.credentialPasswordPreview,
            birthDate: row.birthDate,
            phone: row.phone,
            email: row.email,
            address: row.address,
            emergencyContact: row.emergencyContact,
            jobTitle: jobLabel,
            bossUserId: row.bossUserId,
            bossName: row.boss?.name ?? null,
            hiredAtIso: row.hiredAt.toISOString().slice(0, 10),
            hiredAtFormatted: formatWhen(row.hiredAt),
            hireKindLabel: hireKindLabel(row.hireKind),
            workSchedule: row.workSchedule,
            isActive,
            hasClosedProcesses,
            rfc: row.rfc,
            curp: row.curp,
            nss: row.nss,
            dailyStamped: row.dailyStamped,
            dailyCash: row.dailyCash,
            overtimeRate: row.overtimeRate,
            bankName: row.bankName,
            bankAccount: row.bankAccount,
            commissionEnabled: row.commissionEnabled,
            commissionTiers: parseCommissionTiers(row.commissionTiersJson),
            activitiesEnabled: row.activitiesEnabled,
            activities: parseActivities(row.activitiesJson),
            bonusesEnabled: row.bonusesEnabled,
            punctualityBonusEnabled: row.punctualityBonusEnabled,
            punctualityBonus: row.punctualityBonus,
            productivityBonusEnabled: row.productivityBonusEnabled,
            productivityBonus: row.productivityBonus,
          }}
        />
      ) : null}

      {activeTab === "asistencia" ? (
        <CollaboratorAsistenciaTab
          collaboratorId={row.id}
          version={row.version}
          attendanceMode={row.attendanceMode === "MANUAL" ? "MANUAL" : "AUTOMATICA"}
          isCeo={isCeo}
          today={today}
          currentTime={currentTime}
          rows={row.attendance.map((a) => ({
            id: a.id,
            workDate: a.workDate,
            entryTime: formatTimeMexico(a.entryAt),
            exitTime: formatTimeMexico(a.exitAt),
            status: a.status,
            justified: a.justified,
            justificationStatus: a.justificationStatus,
            note: a.note,
            version: a.version,
          }))}
        />
      ) : null}

      {activeTab === "solicitudes" ? (
        <CollaboratorSolicitudesTab
          collaboratorId={row.id}
          isCeo={isCeo}
          today={today}
          initialSubtab={query.subtab}
          vacations={row.vacations.map((v) => ({
            id: v.id,
            createdAtIso: v.createdAt.toISOString().slice(0, 10),
            startDate: v.startDate,
            endDate: v.endDate,
            days: v.days > 0 ? v.days : weekdaysBetween(v.startDate, v.endDate).length,
            comment: v.comment,
            status: v.status,
            requestedByName: v.requestedBy?.name ?? "—",
            decidedByName: v.decidedBy?.name ?? null,
            decidedAtIso: v.decidedAt ? v.decidedAt.toISOString().slice(0, 10) : null,
            version: v.version,
          }))}
          overtime={row.overtime.map((o) => ({
            id: o.id,
            workDate: o.workDate,
            hours: o.hours,
            authorizedHours: o.authorizedHours,
            reason: o.reason,
            status: o.status,
            requestedByName: o.requestedBy?.name ?? "—",
            authorizedByName: o.authorizedBy?.name ?? null,
            version: o.version,
          }))}
          compensations={row.compensations.map((c) => ({
            id: c.id,
            createdAtIso: c.createdAt.toISOString().slice(0, 10),
            concept: c.concept,
            requestedAmount: c.requestedAmount,
            authorizedAmount: c.authorizedAmount,
            comment: c.comment,
            status: c.status,
            requestedByName: c.requestedBy?.name ?? "—",
            decidedByName: c.decidedBy?.name ?? null,
            version: c.version,
          }))}
          leavePermissions={row.leavePermissions.map((p) => ({
            id: p.id,
            createdAtIso: p.createdAt.toISOString().slice(0, 10),
            startDate: p.startDate,
            endDate: p.endDate,
            reason: p.reason,
            comment: p.comment,
            status: p.status,
            requestedByName: p.requestedBy?.name ?? "—",
            decidedByName: p.decidedBy?.name ?? null,
            version: p.version,
          }))}
        />
      ) : null}

      {activeTab === "documentos" ? (
        <CollaboratorDocumentosTab
          collaboratorId={row.id}
          documents={row.documents.map((d) => ({
            id: d.id,
            title: d.title,
          }))}
        />
      ) : null}
    </>
  );
}
