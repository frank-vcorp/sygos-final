import { notFound, redirect } from "next/navigation";
import { purchaseRequirementAction } from "../../../actions";
import { RequirementPurchaseFormFields } from "../../requirement-purchase-form-fields";
import { Button, FormActions, FormPanel, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ComprarRequerimientoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras/requerimientos");
  const { id } = await params;
  const requirement = await prisma.requirement.findFirst({ where: { id, companyId: session.activeCompanyId, status: "PENDIENTE" } });
  if (!requirement) notFound();
  const [suppliers, categories, accounts] = await Promise.all([
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, currency: true } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, include: { subcategories: { where: { active: true } } }, orderBy: { name: "asc" } }),
    prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
  ]);
  const refaccion = requirement.kind === "REFACCION";
  return (
    <>
      <PageHeader
        back={{ href: "/compras/requerimientos", label: "Requerimientos" }}
        title="Comprar requerimiento"
        subtitle={refaccion ? `${requirement.partNumber} × ${requirement.quantity}. Se conserva el detalle técnico.` : "Completa solo los datos financieros de la compra."}
      />
      <FormPanel action={purchaseRequirementAction}>
        <input type="hidden" name="requirementId" value={requirement.id} />
        <RequirementPurchaseFormFields
          suppliers={suppliers}
          categories={categories}
          accounts={accounts}
          allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
          refaccion={refaccion}
        />
        <FormActions><Button type="submit">Registrar compra</Button></FormActions>
      </FormPanel>
    </>
  );
}
