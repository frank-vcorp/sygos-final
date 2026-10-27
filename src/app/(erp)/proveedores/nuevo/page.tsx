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
      <PageHeader back={{ href: "/proveedores", label: "Proveedores" }} title="Nuevo proveedor" subtitle="Para comenzar solo se requieren el nombre y la moneda. Los datos fiscales se pueden capturar cuando hagan falta." />
      <FormPanel action={createSupplierAction}>
        <FormSection title="Datos generales" description="Nombre y moneda son necesarios para registrar el proveedor.">
          <Field label="Nombre o razón social"><input name="name" required className={controlClass} /></Field>
          <Field label="Moneda"><select name="currency" required defaultValue="MXN" className={controlClass}><option value="MXN">MXN</option><option value="USD">USD</option></select></Field>
          <Field label="Categoría"><input name="category" className={controlClass} /></Field>
          <Field label="Contacto"><input name="contactName" className={controlClass} /></Field>
          <Field label="Teléfono"><input name="phone" className={controlClass} /></Field>
          <Field label="Correo"><input name="email" className={controlClass} /></Field>
        </FormSection>
        <details className="group border-b border-[var(--line)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 text-sm font-semibold text-[var(--ink)] md:px-8 [&::-webkit-details-marker]:hidden">
            <span>Agregar datos fiscales y condiciones comerciales <span className="font-normal text-[var(--muted)]">(opcional)</span></span>
            <span className="text-xs text-[var(--muted)] transition-transform group-open:rotate-180">▼</span>
          </summary>
          <FormSection title="Condiciones fiscales y comerciales" description="Estos datos pueden completarse después, antes de la compra o el pago.">
            <Field label="RFC"><input name="rfc" className={controlClass} /></Field>
            <Field label="Días de crédito"><input name="creditDays" className={controlClass} /></Field>
            <Field label="Emite factura fiscal"><select name="issuesInvoice" className={controlClass} defaultValue=""><option value="">Definir después</option><option value="si">Sí</option><option value="no">No</option></select></Field>
            <div className="md:col-span-2"><Field label="Domicilio fiscal"><textarea name="fiscalAddress" rows={3} className={controlClass} /></Field></div>
          </FormSection>
        </details>
        <FormActions><Button type="submit">Guardar y abrir detalle</Button></FormActions>
      </FormPanel>
    </>
  );
}
