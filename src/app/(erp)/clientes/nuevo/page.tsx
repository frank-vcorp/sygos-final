import { redirect } from "next/navigation";
import { createClientAction } from "../actions";
import { ClientInvoiceFields } from "@/components/client-invoice-fields";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoClientePage() {
  const session = await requireCompany();
  if (!can(session.role, "client.create", session.activeCompanyCode)) redirect("/clientes");
  return (
    <>
      <PageHeader back={{ href: "/clientes", label: "Clientes" }} title="Nuevo cliente" subtitle="El contacto es obligatorio. Los datos fiscales aparecen y se exigen solo si requiere factura." />
      <FormPanel action={createClientAction}>
        <FormSection title="Datos generales" description="Identifica al cliente y define cómo se clasifica comercialmente.">
          <Field label="Nombre o razón social"><input name="name" className={controlClass} required /></Field>
          <Field label="Clasificación">
            <select name="classification" className={controlClass} defaultValue="">
              <option value="">Sin clasificación</option><option value="NORMAL">Normal</option><option value="PREMIUM">Premium</option>
            </select>
          </Field>
          <Field label="Días de crédito"><input name="creditDays" inputMode="numeric" className={controlClass} /></Field>
          <Field label="Dirección de entrega"><textarea name="deliveryAddress" className={controlClass} rows={2} /></Field>
        </FormSection>
        <FormSection title="Facturación" description="Los datos fiscales aparecen únicamente cuando el cliente requiere factura.">
          <ClientInvoiceFields />
        </FormSection>
        <FormSection title="Contacto principal" description="Toda alta necesita al menos una persona de contacto.">
          <Field label="Nombre del contacto"><input name="contactName" required className={controlClass} /></Field>
          <Field label="Puesto"><input name="contactRole" className={controlClass} /></Field>
          <Field label="Teléfono"><input name="contactPhone" className={controlClass} /></Field>
          <Field label="Correo"><input name="contactEmail" className={controlClass} /></Field>
        </FormSection>
        <FormActions note="Podrás agregar más contactos y equipos desde el detalle del cliente."><Button type="submit">Guardar y abrir detalle</Button></FormActions>
      </FormPanel>
    </>
  );
}
