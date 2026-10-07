import { redirect } from "next/navigation";
import { orderAction } from "../actions";
import { SupplierPicker } from "@/components/supplier-picker";
import { controlClass, Field, PageHeader } from "@/components/ui";
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
      <form action={orderAction} className="grid max-w-xl gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <SupplierPicker
          suppliers={suppliers}
          allowQuickSupplier={can(session.role, "supplier.operate", session.activeCompanyCode)}
          allowEmpty
          emptyLabel="Todavía no se conoce"
        />
        <Field label="Concepto"><input name="concept" required className={controlClass} /></Field>
        <Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue="1" className={controlClass} /></Field>
        <Field label="Importe estimado"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
        <Field label="Destino">
          <select name="destination" className={controlClass} defaultValue="GASTO">
            <option value="GASTO">Gasto operativo</option>
            <option value="INVENTARIO">Inventario</option>
            <option value="OS">Orden de servicio</option>
            <option value="MOT">Motor</option>
          </select>
        </Field>
        <Field label="Referencia de destino"><input name="destinationRef" className={controlClass} /></Field>
        <button className="w-fit rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Solicitar orden</button>
      </form>
    </>
  );
}
