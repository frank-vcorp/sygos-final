import { redirect } from "next/navigation";
import { createSupplierAction } from "../actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoProveedorPage() {
  const session = await requireCompany();
  if (!can(session.role, "supplier.operate")) redirect("/inicio");
  return (
    <>
      <PageHeader back={{ href: "/proveedores", label: "Proveedores" }} title="Nuevo proveedor" subtitle="Al crear bastan el nombre y el contacto que ya tengas. Lo fiscal se exige cuando una compra o un pago lo necesite." />
      <FormPanel action={createSupplierAction}>
        <FormSection title="Datos generales" description="Identifica al proveedor y la persona con quien se mantiene contacto.">
          <Field label="Nombre o razón social"><input name="name" required className={controlClass} /></Field>
          <Field label="Categoría"><input name="category" className={controlClass} /></Field>
          <Field label="Contacto"><input name="contactName" className={controlClass} /></Field>
          <Field label="Teléfono"><input name="phone" className={controlClass} /></Field>
          <Field label="Correo"><input name="email" className={controlClass} /></Field>
        </FormSection>
        <FormSection title="Condiciones fiscales y comerciales" description="Estos datos pueden completarse después, antes de la compra o el pago.">
          <Field label="RFC"><input name="rfc" className={controlClass} /></Field>
          <Field label="Días de crédito"><input name="creditDays" className={controlClass} /></Field>
          <Field label="Emite factura fiscal"><select name="issuesInvoice" className={controlClass} defaultValue=""><option value="">Definir después</option><option value="si">Sí</option><option value="no">No</option></select></Field>
          <div className="md:col-span-2"><Field label="Domicilio fiscal"><textarea name="fiscalAddress" rows={3} className={controlClass} /></Field></div>
        </FormSection>
        <FormActions><Button type="submit">Guardar y abrir detalle</Button></FormActions>
      </FormPanel>
    </>
  );
}
