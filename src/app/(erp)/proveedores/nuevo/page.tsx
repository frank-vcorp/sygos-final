import { redirect } from "next/navigation";
import { createSupplierAction } from "../actions";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoProveedorPage() {
  const session = await requireCompany();
  if (!can(session.role, "supplier.operate")) redirect("/inicio");
  return (
    <>
      <PageHeader title="Nuevo proveedor" subtitle="Al crear bastan el nombre y el contacto que ya tengas. Lo fiscal se exige cuando una compra o un pago lo necesite." />
      <form action={createSupplierAction} className="grid max-w-xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Nombre o razón social"><input name="name" required className={controlClass} /></Field>
        <Field label="Contacto"><input name="contactName" className={controlClass} /></Field>
        <Field label="Teléfono"><input name="phone" className={controlClass} /></Field>
        <Field label="Correo"><input name="email" className={controlClass} /></Field>
        <Field label="RFC"><input name="rfc" className={controlClass} /></Field>
        <Field label="Domicilio fiscal"><textarea name="fiscalAddress" rows={2} className={controlClass} /></Field>
        <Field label="Días de crédito"><input name="creditDays" className={controlClass} /></Field>
        <Field label="Emite factura fiscal">
          <select name="issuesInvoice" className={controlClass} defaultValue="">
            <option value="">Definir después</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Categoría"><input name="category" className={controlClass} /></Field>
        <Button type="submit">Guardar y abrir detalle</Button>
      </form>
    </>
  );
}
