import { redirect } from "next/navigation";
import { createClientAction } from "../actions";
import { RegimenSelect } from "@/components/regimen-select";
import { Button, controlClass, Field, PageHeader } from "@/components/ui";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoClientePage() {
  const session = await requireCompany();
  if (!can(session.role, "client.create", session.activeCompanyCode)) redirect("/clientes");
  return (
    <>
      <PageHeader title="Nuevo cliente" subtitle="Solo el nombre es obligatorio. Los datos fiscales se completan antes de facturar." />
      <form action={createClientAction} className="grid max-w-2xl gap-4 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Nombre o razón social"><input name="name" className={controlClass} required /></Field>
        <Field label="Clasificación">
          <select name="classification" className={controlClass} defaultValue="">
            <option value="">Sin clasificación</option>
            <option value="NORMAL">Normal</option>
            <option value="PREMIUM">Premium</option>
          </select>
        </Field>
        <Field label="Requiere factura">
          <select name="requiresInvoice" className={controlClass} defaultValue="">
            <option value="">Definir después</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Días de crédito"><input name="creditDays" inputMode="numeric" className={controlClass} /></Field>
        <Field label="RFC"><input name="rfc" className={controlClass} /></Field>
        <Field label="Régimen fiscal" hint="Catálogo c_RegimenFiscal del SAT."><RegimenSelect name="taxRegime" /></Field>
        <Field label="Código postal fiscal"><input name="fiscalZip" className={controlClass} /></Field>
        <Field label="Domicilio fiscal"><textarea name="fiscalAddress" className={controlClass} rows={2} /></Field>
        <Field label="Dirección de entrega"><textarea name="deliveryAddress" className={controlClass} rows={2} /></Field>
        <Button type="submit">Guardar y abrir detalle</Button>
      </form>
    </>
  );
}
