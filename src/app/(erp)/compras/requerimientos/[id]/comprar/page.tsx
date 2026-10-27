import { notFound, redirect } from "next/navigation";
import { purchaseRequirementAction } from "../../../actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput, PageHeader } from "@/components/ui";
import { SupplierPicker } from "@/components/supplier-picker";
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
    prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, include: { subcategories: { where: { active: true } } }, orderBy: { name: "asc" } }),
    prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
  ]);
  const refaccion = requirement.kind === "REFACCION";
  return <><PageHeader back={{ href: "/compras/requerimientos", label: "Requerimientos" }} title="Comprar requerimiento" subtitle={refaccion ? `${requirement.partNumber} × ${requirement.quantity}. Se conserva el detalle técnico.` : "Completa solo los datos financieros de la compra."} />
    <FormPanel action={purchaseRequirementAction}><input type="hidden" name="requirementId" value={requirement.id} />
      <FormSection title="Datos de compra" description="La moneda se hereda del proveedor.">
        <div className="md:col-span-2"><SupplierPicker suppliers={suppliers} required allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)} /></div>
        <Field label="Fecha de compra"><input name="purchaseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={controlClass} /></Field>
        <Field label="Monto"><MoneyInput name="amount" min="0.01" required /></Field>
        {refaccion ? <div className="md:col-span-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"><span className="text-[var(--muted)]">Clasificación de egreso</span><strong className="ml-2">Producción y operación · Refacciones y componentes</strong></div> : <><Field label="Categoría de egreso"><select name="expenseCategoryId" defaultValue="" required className={controlClass}><option value="" disabled>Selecciona una categoría</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
        <Field label="Subcategoría"><select name="expenseSubcategoryId" defaultValue="" className={controlClass}><option value="">Sin subcategoría</option>{categories.flatMap((item) => item.subcategories.map((sub) => <option key={sub.id} value={sub.id}>{item.name} · {sub.name}</option>))}</select></Field></>}
        <Field label="Descripción general"><input name="concept" defaultValue={refaccion ? "Compra de refacciones y componentes" : requirement.description} className={controlClass} /></Field>
        <Field label="Forma de pago"><select name="paymentType" defaultValue="CONTADO" className={controlClass}><option value="CONTADO">Contado</option><option value="CREDITO">Crédito</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option></select></Field>
        <Field label="Banco / cuenta, si aplica"><select name="accountId" defaultValue="" className={controlClass}><option value="">No aplica</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      </FormSection><FormActions><Button type="submit">Registrar compra</Button></FormActions>
    </FormPanel></>;
}
