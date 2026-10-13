import { redirect } from "next/navigation";
import { createClientAction } from "../actions";
import { ClientInvoiceFields } from "@/components/client-invoice-fields";
import { Button, controlClass, Field, FormActions, FormBlock, FormPanel, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoClientePage() {
  const session = await requireCompany();
  if (!can(session.role, "client.create", session.activeCompanyCode)) redirect("/clientes");
  return (
    <>
      <PageHeader
        back={{ href: "/clientes", label: "Clientes" }}
        title="Nuevo cliente"
        subtitle="Captura lo indispensable para que el cliente quede listo para cotizar o iniciar un servicio."
      />
      <FormPanel action={createClientAction}>
        <div className="grid gap-5 p-4 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <FormBlock
              title="Identidad comercial"
              description="Define quién es el cliente y las condiciones básicas de operación."
              columns={2}
            >
              <Field label="Nombre o razón social" hint="Obligatorio.">
                <input name="name" className={controlClass} required />
              </Field>
              <Field label="Clasificación">
                <select name="classification" className={controlClass} defaultValue="NORMAL">
                  <option value="">Sin clasificación</option>
                  <option value="NORMAL">Normal</option>
                  <option value="PREMIUM">Premium</option>
                </select>
              </Field>
              <Field label="Días de crédito" hint="Se heredan a la cotización cuando corresponda.">
                <input name="creditDays" inputMode="numeric" className={controlClass} defaultValue="0" />
              </Field>
              <Field label="Dirección de entrega" hint="Opcional.">
                <textarea name="deliveryAddress" className={controlClass} rows={2} />
              </Field>
            </FormBlock>

            <FormBlock
              title="Contacto principal"
              description="Toda alta necesita una persona a quien podamos contactar."
              columns={2}
            >
              <Field label="Nombre del contacto">
                <input name="contactName" required className={controlClass} />
              </Field>
              <Field label="Teléfono">
                <input name="contactPhone" required className={controlClass} />
              </Field>
              <Field label="Puesto">
                <input name="contactRole" className={controlClass} />
              </Field>
              <Field label="Correo">
                <input name="contactEmail" type="email" className={controlClass} />
              </Field>
            </FormBlock>
          </div>

          <FormBlock
            title="Facturación"
            description="Indica si el cliente requiere CFDI. Los datos fiscales aparecen solo cuando son necesarios."
            columns={2}
            tone="muted"
          >
            <ClientInvoiceFields />
          </FormBlock>
        </div>

        <FormActions note="Puedes guardar ahora y crear una Atención después, o continuar directamente con el servicio.">
          <Button type="submit" name="nextStep" value="detail" tone="ghost">
            Guardar cliente
          </Button>
          <Button type="submit" name="nextStep" value="attention">
            Guardar y crear Atención
          </Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
