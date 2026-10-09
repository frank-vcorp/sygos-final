import { redirect } from "next/navigation";
import { directPurchaseAction } from "../actions";
import { SupplierPicker } from "@/components/supplier-picker";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevaCompraPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const suppliers = await prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader back={{ href: "/compras", label: "Compras" }} title="Compra directa" subtitle="Solo entra si cabe en el máximo por compra y en el presupuesto del mes." />
      <FormPanel action={directPurchaseAction}>
        <FormSection title="Proveedor y concepto" description="La compra directa consume presupuesto desde que se registra.">
          <div className="md:col-span-2">
            <SupplierPicker
              suppliers={suppliers}
              allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
              required
            />
          </div>
          <Field label="Concepto"><input name="concept" required className={controlClass} /></Field>
          <Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue="1" className={controlClass} /></Field>
          <Field label="Importe"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
        </FormSection>
        <FormSection title="Destino" description="Indica dónde impacta la compra en la operación." columns={1}>
          <Field label="Destino">
            <select name="destination" className={controlClass} defaultValue="GASTO">
              <option value="GASTO">Gasto operativo</option>
              <option value="INVENTARIO">Inventario</option>
              <option value="OS">Orden de servicio</option>
              <option value="MOT">Motor</option>
            </select>
          </Field>
          <Field label="Referencia de destino" hint="Folio de OS, MOT u otra referencia cuando aplique.">
            <input name="destinationRef" className={controlClass} placeholder="Folio, si aplica" />
          </Field>
        </FormSection>
        <FormActions>
          <Button type="submit">Registrar compra</Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
