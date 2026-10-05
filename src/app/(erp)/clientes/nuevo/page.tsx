import { redirect } from "next/navigation";
import { createClientAction } from "../actions";
import { ClientInvoiceFields } from "@/components/client-invoice-fields";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoClientePage() {
  const session = await requireCompany();
  if (!can(session.role, "client.create", session.activeCompanyCode)) redirect("/clientes");
  return (
    <>
      <PageHeader back={{ href: "/clientes", label: "Clientes" }} title="Nuevo cliente" subtitle="El contacto es obligatorio. Los datos fiscales aparecen y se exigen solo si requiere factura." />
      <form action={createClientAction} className="grid max-w-2xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Nombre o razón social"><input name="name" className={controlClass} required /></Field>
        <Field label="Clasificación">
          <select name="classification" className={controlClass} defaultValue="">
            <option value="">Sin clasificación</option>
            <option value="NORMAL">Normal</option>
            <option value="PREMIUM">Premium</option>
          </select>
        </Field>
        <ClientInvoiceFields />
        <Field label="Días de crédito"><input name="creditDays" inputMode="numeric" className={controlClass} /></Field>
        <Field label="Dirección de entrega"><textarea name="deliveryAddress" className={controlClass} rows={2} /></Field>
        <h2 className="font-medium">Contacto</h2>
        <Field label="Nombre del contacto"><input name="contactName" required className={controlClass} /></Field>
        <Field label="Puesto"><input name="contactRole" className={controlClass} /></Field>
        <Field label="Teléfono"><input name="contactPhone" className={controlClass} /></Field>
        <Field label="Correo"><input name="contactEmail" className={controlClass} /></Field>
        <Button type="submit">Guardar y abrir detalle</Button>
      </form>
    </>
  );
}
