import { redirect } from "next/navigation";
import { phaseOnePurchaseAction } from "../actions";
import { SupplierPicker } from "@/components/supplier-picker";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function RegistrarCompraPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const suppliers = await prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } });
  const categories = await prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, include: { subcategories: { where: { active: true } } }, orderBy: { name: "asc" } });
  const accounts = await prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader back={{ href: "/compras", label: "Compras" }} title="Registrar compra" subtitle="Usa este formulario para una compra urgente ya realizada, sin requerimiento ni lista." />
      <FormPanel action={phaseOnePurchaseAction}>
        <FormSection title="Proveedor y detalle técnico opcional">
          <div className="md:col-span-2"><SupplierPicker suppliers={suppliers} allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)} required /></div>
          <Field label="Descripción general"><input name="concept" required className={controlClass} /></Field>
          <Field label="Número de parte (opcional)"><input name="partNumber" className={controlClass} /></Field>
          <Field label="Descripción"><input name="description" className={controlClass} /></Field>
          <Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue="1" className={controlClass} /></Field>
          <Field label="Monto"><MoneyInput name="amount" required min="0.01" /></Field>
        </FormSection>
        <FormSection title="Datos para Finanzas">
          <Field label="Categoría de egreso"><select name="expenseCategoryId" required className={controlClass} defaultValue=""><option value="" disabled>Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></Field>
          <Field label="Subcategoría"><select name="expenseSubcategoryId" defaultValue="" className={controlClass}><option value="">Sin subcategoría</option>{categories.flatMap((category) => category.subcategories.map((sub) => <option key={sub.id} value={sub.id}>{category.name} · {sub.name}</option>))}</select></Field>
          <Field label="Tipo de pago"><select name="paymentType" required className={controlClass} defaultValue="CONTADO"><option value="CONTADO">Contado</option><option value="CREDITO">Crédito</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option></select></Field>
          <Field label="Banco / cuenta, si aplica"><select name="accountId" defaultValue="" className={controlClass}><option value="">No aplica</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
          <Field label="Fecha de compra"><input name="purchaseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className={controlClass} /></Field>
        </FormSection>
        <FormActions><Button type="submit">Guardar compra realizada</Button></FormActions>
      </FormPanel>
    </>
  );
}
