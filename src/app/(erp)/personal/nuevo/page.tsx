import { redirect } from "next/navigation";
import { NewCollaboratorForm, type RoleOption } from "./new-collaborator-form";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { laborProfile, mexicoToday, roleAvailableForCollaborator } from "@/lib/personnel";
import { ROLE_LABEL, ROLES } from "@/lib/roles";
import { requireCompany } from "@/lib/session";

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
    roleAvailableForCollaborator(r, session.activeCompanyCode, session.role),
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
