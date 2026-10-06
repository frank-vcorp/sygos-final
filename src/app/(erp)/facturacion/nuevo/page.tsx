import { redirect } from "next/navigation";
import { freeInvoiceAction } from "../actions";
import { controlClass, Field, PageHeader } from "@/components/ui";
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
      <form action={freeInvoiceAction} className="grid max-w-xl gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Cliente">
          <select name="clientId" required className={controlClass} defaultValue="">
            <option value="">Selecciona</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </Field>
        <Field label="Concepto"><input name="concept" required className={controlClass} /></Field>
        <Field label="Importe con IVA"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
        <Field label="Días de crédito"><input name="creditDays" type="number" min="0" className={controlClass} /></Field>
        <button className="w-fit rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Emitir factura libre</button>
      </form>
    </>
  );
}
