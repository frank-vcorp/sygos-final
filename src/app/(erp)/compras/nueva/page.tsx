import { redirect } from "next/navigation";
import { phaseOnePurchaseAction } from "../actions";
import { SupplierPicker } from "@/components/supplier-picker";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, MoneyInput, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevaCompraPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const suppliers = await prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } });
  const categories = await prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader back={{ href: "/compras", label: "Compras" }} title="Nueva compra" subtitle="Crea una compra en preparación para reunir partidas antes de realizar el pedido." />
      <FormPanel action={phaseOnePurchaseAction}>
        <input type="hidden" name="planned" value="si" />
        <FormSection title="Proveedor y partida" description="La moneda se hereda del proveedor y no se elige en la compra.">
          <div className="md:col-span-2">
            <SupplierPicker
              suppliers={suppliers}
              allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
              required
            />
          </div>
          <Field label="Número de parte"><input name="partNumber" required className={controlClass} /></Field>
          <Field label="Descripción"><input name="description" className={controlClass} /></Field>
          <Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue="1" className={controlClass} /></Field>
          <Field label="Monto"><MoneyInput name="amount" required min="0.01" /></Field>
        </FormSection>
        <FormSection title="Datos para Finanzas" columns={2}>
          <Field label="Categoría de egreso"><select name="expenseCategory" required className={controlClass} defaultValue=""><option value="" disabled>Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></Field>
          <Field label="Subcategoría"><input name="expenseSubcategory" className={controlClass} /></Field>
          <Field label="Tipo de pago"><select name="paymentType" required className={controlClass} defaultValue="CONTADO"><option value="CONTADO">Contado</option><option value="CREDITO">Crédito</option><option value="TARJETA">Tarjeta</option><option value="TRANSFERENCIA">Transferencia</option></select></Field>
          <Field label="Fecha de compra"><input name="purchaseDate" type="date" required className={controlClass} /></Field>
        </FormSection>
        <FormActions>
          <Button type="submit">Crear compra en preparación</Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
