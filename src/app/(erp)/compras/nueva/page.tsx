import { redirect } from "next/navigation";
import { PurchaseRegistrationModal } from "@/components/purchase-registration-modal";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevaCompraPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const [suppliers, categories, accounts] = await Promise.all([
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, include: { subcategories: { where: { active: true } } }, orderBy: { name: "asc" } }),
    prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/compras", label: "Compras" }}
        title="Registrar compra"
        subtitle="Compra urgente ya realizada, sin requerimiento ni lista."
      />
      <PurchaseRegistrationModal
        suppliers={suppliers.map((supplier) => ({ id: supplier.id, name: `${supplier.name} · ${supplier.currency}` }))}
        categories={categories}
        accounts={accounts}
        allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
        initiallyOpen
        showTrigger={false}
        returnHref="/compras"
      />
    </>
  );
}
