import { redirect } from "next/navigation";
import { RequirementCreateModal } from "../requirement-create-modal";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoRequerimientoPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.requirement.create", session.activeCompanyCode)) redirect("/compras/requerimientos");
  const allowRefaccionKind = can(session.role, "purchase.requirement.refaccion", session.activeCompanyCode);

  return (
    <>
      <PageHeader
        back={{ href: "/compras/requerimientos", label: "Requerimientos" }}
        title="Nuevo requerimiento"
        subtitle="Captura la partida; la clasificación financiera ocurre al comprar."
      />
      <RequirementCreateModal
        initiallyOpen
        showTrigger={false}
        returnHref="/compras/requerimientos"
        lockKind={!allowRefaccionKind}
        defaultKind="GENERAL"
      />
    </>
  );
}
