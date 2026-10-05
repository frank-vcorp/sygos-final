import { notFound, redirect } from "next/navigation";
import { setSupplierActiveAction, updateSupplierAction } from "../actions";
import { Badge, Button, controlClass, Field, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/form";
import { historyFor } from "@/lib/history";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ProveedorDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "supplier.operate")) redirect("/inicio");
  const { id } = await params;
  const supplier = await prisma.supplier.findFirst({ where: { id, companyId: session.activeCompanyId } });
  if (!supplier) notFound();
  const history = await historyFor("PROVEEDOR", supplier.id);
  return (
    <>
      <PageHeader title={supplier.name} subtitle={supplier.isSystem ? "Proveedor intercompañía fijo" : session.activeCompanyName ?? ""} action={supplier.active ? <Badge tone="ok">Activo</Badge> : <Badge>Inactivo</Badge>} />
      {supplier.isSystem ? (
        <p className="text-sm">Servomotores es el proveedor fijo de SYSTRON para obligaciones entre empresas. No se edita ni se inactiva.</p>
      ) : (
        <form action={updateSupplierAction} className="grid max-w-xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
          <input type="hidden" name="id" value={supplier.id} />
          <input type="hidden" name="version" value={supplier.version} />
          <Field label="Nombre o razón social"><input name="name" defaultValue={supplier.name} className={controlClass} /></Field>
          <Field label="Contacto"><input name="contactName" defaultValue={supplier.contactName ?? ""} className={controlClass} /></Field>
          <Field label="Teléfono"><input name="phone" defaultValue={supplier.phone ?? ""} className={controlClass} /></Field>
          <Field label="Correo"><input name="email" defaultValue={supplier.email ?? ""} className={controlClass} /></Field>
          <Field label="RFC"><input name="rfc" defaultValue={supplier.rfc ?? ""} className={controlClass} /></Field>
          <Field label="Domicilio fiscal"><textarea name="fiscalAddress" defaultValue={supplier.fiscalAddress ?? ""} rows={2} className={controlClass} /></Field>
          <Field label="Días de crédito"><input name="creditDays" defaultValue={supplier.creditDays ?? ""} className={controlClass} /></Field>
          <Field label="Emite factura fiscal">
            <select name="issuesInvoice" defaultValue={supplier.issuesInvoice == null ? "" : supplier.issuesInvoice ? "si" : "no"} className={controlClass}>
              <option value="">Sin definir</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Categoría"><input name="category" defaultValue={supplier.category ?? ""} className={controlClass} /></Field>
          <Button type="submit">Guardar</Button>
        </form>
      )}
      {!supplier.isSystem ? (
        <form action={setSupplierActiveAction} className="mt-4">
          <input type="hidden" name="id" value={supplier.id} />
          <input type="hidden" name="version" value={supplier.version} />
          <input type="hidden" name="active" value={supplier.active ? "no" : "si"} />
          <Button type="submit" tone={supplier.active ? "danger" : "ghost"}>{supplier.active ? "Inactivar" : "Reactivar"}</Button>
        </form>
      ) : null}
      <p className="mt-6 text-sm text-[var(--muted)]">Compras, órdenes de compra, cuentas por pagar y servicio externo se abren desde aquí cuando existan.</p>
      <ul className="mt-4 space-y-2 text-sm">
        {history.map((item) => (
          <li key={item.id} className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
            <span className="text-[var(--muted)]">{formatWhen(item.createdAt)} · {item.author?.name ?? "Sistema"}</span>
            <p>{item.summary}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
