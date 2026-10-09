import { redirect } from "next/navigation";
import { freeInvoiceAction } from "../actions";
import { ClientPicker } from "@/components/client-picker";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function FacturaLibrePage() {
  const session = await requireCompany();
  if (!can(session.role, "invoice.issue", session.activeCompanyCode)) redirect("/facturacion");
  const clients = await prisma.client.findMany({
    where: { companyId: session.activeCompanyId, active: true, isSystem: false },
    orderBy: { name: "asc" },
    take: 200,
  });
  return (
    <>
      <PageHeader back={{ href: "/facturacion", label: "Facturación" }} title="Factura libre" subtitle="No crea equipo, diagnóstico ni venta. Sí abre cuenta por cobrar." />
      <FormPanel action={freeInvoiceAction} className="max-w-xl">
        <FormSection title="Factura libre" description="No crea equipo ni venta. Abre cuenta por cobrar con el cliente elegido.">
          <div className="md:col-span-2">
            <ClientPicker
              clients={clients}
              allowQuickClient={can(session.role, "client.create", session.activeCompanyCode)}
            />
          </div>
          <Field label="Concepto"><input name="concept" required className={controlClass} /></Field>
          <Field label="Importe con IVA"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
          <Field label="Días de crédito"><input name="creditDays" type="number" min="0" className={controlClass} /></Field>
        </FormSection>
        <FormActions note="La emisión queda registrada en facturación y cobranza.">
          <Button type="submit">Emitir factura libre</Button>
        </FormActions>
      </FormPanel>
    </>
  );
}
