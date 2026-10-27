import { notFound, redirect } from "next/navigation";
import { addToShoppingListAction } from "../../../actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { SupplierPicker } from "@/components/supplier-picker";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function AgregarAListaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras/requerimientos");
  const { id } = await params;
  const [requirement, lists, suppliers] = await Promise.all([
    prisma.requirement.findFirst({ where: { id, companyId: session.activeCompanyId, status: "PENDIENTE" } }),
    prisma.shoppingList.findMany({ where: { companyId: session.activeCompanyId, status: "ABIERTA" }, include: { supplier: true }, orderBy: { createdAt: "desc" } }),
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!requirement) notFound();
  return <><PageHeader back={{ href: "/compras/requerimientos", label: "Requerimientos" }} title="Agregar a lista" subtitle="Ajusta la partida y elige una lista abierta o crea una nueva." />
    <FormPanel action={addToShoppingListAction}><input type="hidden" name="requirementId" value={requirement.id} />
      <FormSection title="Lista y partida">
        <Field label="Lista de compras"><select name="shoppingListId" defaultValue="" className={controlClass}><option value="">Crear nueva lista</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.folio}{list.supplier ? ` — ${list.supplier.name}` : ""}</option>)}</select></Field>
        <div className="md:col-span-2"><SupplierPicker suppliers={suppliers} allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)} allowEmpty emptyLabel="Sin proveedor por ahora" /></div>
        <Field label="Número de parte"><input name="partNumber" defaultValue={requirement.partNumber} required className={controlClass} /></Field>
        <Field label="Descripción"><input name="description" defaultValue={requirement.description} className={controlClass} /></Field>
        <Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue={requirement.quantity} required className={controlClass} /></Field>
      </FormSection><FormActions><Button type="submit">Agregar a lista</Button></FormActions>
    </FormPanel></>;
}
