import { redirect } from "next/navigation";
import { ShoppingListCreateModal } from "../shopping-list-create-modal";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevaListaCompraPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras/listas");
  const suppliers = await prisma.supplier.findMany({
    where: { companyId: session.activeCompanyId, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        back={{ href: "/compras/listas", label: "Listas de compras" }}
        title="Nueva lista"
        subtitle="Elige si es de generales o refacciones y, si quieres, asigna proveedor."
      />
      <ShoppingListCreateModal
        suppliers={suppliers}
        allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
        initiallyOpen
        showTrigger={false}
        returnHref="/compras/listas"
      />
    </>
  );
}
