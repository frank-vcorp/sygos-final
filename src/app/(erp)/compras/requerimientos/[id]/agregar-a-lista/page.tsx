import { notFound, redirect } from "next/navigation";
import { addToShoppingListAction } from "../../../actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { ShoppingListSelection } from "@/components/shopping-list-selection";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { normalizeShoppingListKind, shoppingListKindFromList } from "@/lib/shopping-list-display";
import { requireCompany } from "@/lib/session";

export default async function AgregarAListaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras/requerimientos");
  const { id } = await params;
  const [requirement, lists, suppliers] = await Promise.all([
    prisma.requirement.findFirst({ where: { id, companyId: session.activeCompanyId, status: "PENDIENTE" } }),
    prisma.shoppingList.findMany({
      where: { companyId: session.activeCompanyId, status: "ABIERTA" },
      include: { supplier: true, lines: { include: { requirement: { select: { kind: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!requirement) notFound();
  return <><PageHeader back={{ href: "/compras/requerimientos", label: "Requerimientos" }} title="Agregar a lista" subtitle="Ajusta la partida y elige una lista abierta o crea una nueva." />
    <FormPanel action={addToShoppingListAction}><input type="hidden" name="requirementId" value={requirement.id} />
      <input type="hidden" name="requirementKind" value={requirement.kind} />
      <FormSection title="Lista y partida">
        <ShoppingListSelection
          lists={lists.map((list) => ({
            id: list.id,
            folio: list.folio,
            kind: shoppingListKindFromList(list),
            supplierId: list.supplierId,
            supplierName: list.supplier?.name ?? null,
          }))}
          suppliers={suppliers}
          allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
          listKind={normalizeShoppingListKind(requirement.kind)}
        />
        <Field label="Número de parte"><input name="partNumber" defaultValue={requirement.partNumber} required={requirement.kind === "REFACCION"} className={controlClass} /></Field>
        <Field label="Descripción"><input name="description" defaultValue={requirement.description} className={controlClass} /></Field>
        <Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue={requirement.quantity} required className={controlClass} /></Field>
      </FormSection><FormActions><Button type="submit">Agregar a lista</Button></FormActions>
    </FormPanel></>;
}
