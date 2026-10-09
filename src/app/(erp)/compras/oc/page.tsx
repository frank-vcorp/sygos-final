import { redirect } from "next/navigation";
import { orderAction } from "../actions";
import { SupplierPicker } from "@/components/supplier-picker";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevaOrdenPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const suppliers = await prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader back={{ href: "/compras", label: "Compras" }} title="Orden de compra" subtitle="Es una solicitud interna. No compromete al proveedor ni mueve dinero hasta que Coordinación la procesa." />
      <FormPanel action={orderAction}>
        <FormSection title="Proveedor y concepto">
          <div className="md:col-span-2">
            <SupplierPicker
              suppliers={suppliers}
              allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
              allowEmpty
              emptyLabel="Todavía no se conoce"
            />
          </div>
          <Field label="Concepto"><input name="concept" required className={controlClass} /></Field>
          <Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue="1" className={controlClass} /></Field>
          <Field label="Importe estimado"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
        </FormSection>
        <FormSection title="Destino" columns={1}>
          <Field label="Destino">
            <select name="destination" className={controlClass} defaultValue="GASTO">
              <option value="GASTO">Gasto operativo</option>
              <option value="INVENTARIO">Inventario</option>
              <option value="OS">Orden de servicio</option>
              <option value="MOT">Motor</option>
            </select>
          </Field>
          <Field label="Referencia de destino"><input name="destinationRef" className={controlClass} /></Field>
        </FormSection>
        <FormActions note="El CEO autoriza antes de procesar.">
          <Button type="submit">Solicitar orden de compra</Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
