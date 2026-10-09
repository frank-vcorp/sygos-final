import { notFound, redirect } from "next/navigation";
import { setSupplierActiveAction, updateSupplierAction } from "../actions";
import { HistoryTimeline } from "@/components/history-timeline";
import {
  Badge,
  Button,
  controlClass,
  DetailAnchorButton,
  EntityDetailHeader,
  EntityMetaItem,
  Field,
  FormActions,
  FormPanel,
  FormSection,
} from "@/components/ui";
import { prisma } from "@/lib/db";
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
      <EntityDetailHeader
        back={{ href: "/proveedores", label: "Proveedores" }}
        title={supplier.name}
        subtitle={supplier.isSystem ? "Proveedor intercompañía fijo" : session.activeCompanyName ?? ""}
        status={supplier.active ? <Badge tone="ok">Activo</Badge> : <Badge>Inactivo</Badge>}
        meta={
          supplier.isSystem ? null : (
            <>
              {supplier.contactName ? <EntityMetaItem label="Contacto">{supplier.contactName}</EntityMetaItem> : null}
              {supplier.phone ? <EntityMetaItem label="Teléfono">{supplier.phone}</EntityMetaItem> : null}
              {supplier.category ? <EntityMetaItem label="Categoría">{supplier.category}</EntityMetaItem> : null}
              {supplier.creditDays != null ? <EntityMetaItem label="Crédito">{supplier.creditDays} días</EntityMetaItem> : null}
            </>
          )
        }
        primaryAction={supplier.isSystem ? null : <DetailAnchorButton href="#datos-proveedor">Editar datos</DetailAnchorButton>}
      />
      {supplier.isSystem ? (
        <p className="text-sm">Servomotores es el proveedor fijo de SYSTRON para obligaciones entre empresas. No se edita ni se inactiva.</p>
      ) : (
        <FormPanel id="datos-proveedor" action={updateSupplierAction} className="scroll-mt-24">
          <input type="hidden" name="id" value={supplier.id} />
          <input type="hidden" name="version" value={supplier.version} />
          <FormSection title="Datos generales" description="Nombre, contacto y categoría comercial.">
            <Field label="Nombre o razón social"><input name="name" defaultValue={supplier.name} className={controlClass} /></Field>
            <Field label="Categoría"><input name="category" defaultValue={supplier.category ?? ""} className={controlClass} /></Field>
            <Field label="Contacto"><input name="contactName" defaultValue={supplier.contactName ?? ""} className={controlClass} /></Field>
            <Field label="Teléfono"><input name="phone" defaultValue={supplier.phone ?? ""} className={controlClass} /></Field>
            <Field label="Correo"><input name="email" defaultValue={supplier.email ?? ""} className={controlClass} /></Field>
          </FormSection>
          <FormSection title="Fiscal y condiciones" description="Se validan al procesar compras y pagos.">
            <Field label="RFC"><input name="rfc" defaultValue={supplier.rfc ?? ""} className={controlClass} /></Field>
            <Field label="Días de crédito"><input name="creditDays" defaultValue={supplier.creditDays ?? ""} className={controlClass} /></Field>
            <Field label="Emite factura fiscal">
              <select name="issuesInvoice" defaultValue={supplier.issuesInvoice == null ? "" : supplier.issuesInvoice ? "si" : "no"} className={controlClass}>
                <option value="">Sin definir</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Domicilio fiscal"><textarea name="fiscalAddress" defaultValue={supplier.fiscalAddress ?? ""} rows={2} className={controlClass} /></Field>
            </div>
          </FormSection>
          <FormActions><Button type="submit">Guardar cambios</Button></FormActions>
        </FormPanel>
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
      <HistoryTimeline className="mt-6" items={history.map((item) => ({ id: item.id, createdAt: item.createdAt, summary: item.summary, authorName: item.author?.name }))} />
    </>
  );
}
