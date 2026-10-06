import { redirect } from "next/navigation";
import { directPurchaseAction } from "../actions";
import { controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevaCompraPage() {
  const session = await requireCompany();
  if (!can(session.role, "purchase.operate", session.activeCompanyCode)) redirect("/compras");
  const suppliers = await prisma.supplier.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader back={{ href: "/compras", label: "Compras" }} title="Compra directa" subtitle="Solo entra si cabe en el máximo por compra y en el presupuesto del mes." />
      <form action={directPurchaseAction} className="grid max-w-xl gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Proveedor">
          <select name="supplierId" required className={controlClass} defaultValue="">
            <option value="">Selecciona</option>
            {suppliers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </Field>
        <Field label="Concepto"><input name="concept" required className={controlClass} /></Field>
        <Field label="Cantidad"><input name="quantity" type="number" min="1" defaultValue="1" className={controlClass} /></Field>
        <Field label="Importe"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
        <Field label="Destino">
          <select name="destination" className={controlClass} defaultValue="GASTO">
            <option value="GASTO">Gasto operativo</option>
            <option value="INVENTARIO">Inventario</option>
            <option value="OS">Orden de servicio</option>
            <option value="MOT">Motor</option>
          </select>
        </Field>
        <Field label="Referencia de destino"><input name="destinationRef" className={controlClass} placeholder="Folio, si aplica" /></Field>
        <button className="w-fit rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Registrar compra</button>
      </form>
    </>
  );
}
