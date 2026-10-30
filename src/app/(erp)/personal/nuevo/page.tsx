import { redirect } from "next/navigation";
import { NewCollaboratorForm, type RoleOption } from "./new-collaborator-form";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { laborProfile, mexicoToday } from "@/lib/personnel";
import { companiesForRole, ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { requireCompany } from "@/lib/session";

function roleAvailableForCollaborator(role: Role, companyCode: string): boolean {
  if (role === "ADMINISTRADOR" || role === "CEO" || role === "KIOSCO_ASISTENCIA") return false;
  const allowed = companiesForRole(role);
  if (allowed === "both") return true;
  return allowed.includes(companyCode as "SYSTRON" | "SERVOMOTORES");
}

export default async function NuevoColaboradorPage() {
  const session = await requireCompany();
  if (!can(session.role, "personnel.authorize")) redirect("/personal");

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

  const roleOptions: RoleOption[] = ROLES.filter((r) =>
    roleAvailableForCollaborator(r, session.activeCompanyCode),
  ).map((r) => ({
    value: r,
    label: ROLE_LABEL[r],
    exemptBoss: laborProfile(r).exempt,
  }));

  return (
    <>
      <PageHeader
        back={{ href: "/personal", label: "Colaboradores" }}
        title="Nuevo colaborador"
        subtitle={`${session.activeCompanyName} · Alta completa de colaborador y credenciales de acceso al sistema.`}
      />
      <NewCollaboratorForm
        companyName={session.activeCompanyName}
        today={mexicoToday()}
        roles={roleOptions}
        bosses={bosses.map((b) => ({ id: b.id, name: b.name }))}
      />
    </>
  );
}
