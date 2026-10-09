import { redirect } from "next/navigation";
import { CountForm } from "@/components/count-form";
import { PageHeader, TextLink } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ConteoPage() {
  const session = await requireCompany();
  if (!can(session.role, "inventory.operate", session.activeCompanyCode)) redirect("/inicio");
  const company = await prisma.company.findUnique({ where: { id: session.activeCompanyId } });
  if (!company?.inventoryEnabled) redirect("/inventario");
  return (
    <>
      <PageHeader title="Conteo físico" subtitle="Compara contra la existencia vigente antes de aplicar. No crea partes nuevas." action={<TextLink href="/inventario">Volver a inventario</TextLink>} />
      <CountForm />
    </>
  );
}
