import { redirect } from "next/navigation";
import { intercompanyPaymentAction, registerPaymentAction } from "../actions";
import { Button, controlClass, Field, FormActions, FormPanel, FormSection, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function NuevoPagoPage() {
  const session = await requireCompany();
  if (!can(session.role, "payment.register", session.activeCompanyCode) && !can(session.role, "payment.validate", session.activeCompanyCode)) redirect("/inicio");
  const receivables = await prisma.receivable.findMany({
    where: { companyId: session.activeCompanyId, balance: { gt: 0 }, ...(session.role === "VENTAS" ? { sellerUserId: session.userId } : {}) },
    include: { client: true, document: true },
    orderBy: { dueAt: "asc" },
  });
  const payables = session.activeCompanyCode === "SYSTRON" && can(session.role, "payment.validate", session.activeCompanyCode)
    ? await prisma.payable.findMany({ where: { companyId: session.activeCompanyId, balance: { gt: 0 } }, include: { document: true } })
    : [];
  return (
    <>
      <PageHeader back={{ href: "/pagos", label: "Pagos" }} title="Registrar pago" subtitle="El vendedor lo deja pendiente. Coordinación, CEO o Administrador pueden dejarlo validado." />
      <FormPanel action={registerPaymentAction}>
        <FormSection title="Aplicación del pago" description="Selecciona el documento y captura la evidencia del movimiento.">
          <div className="md:col-span-2"><Field label="Cuenta por cobrar"><select name="receivableId" required className={controlClass} defaultValue=""><option value="">Selecciona</option>{receivables.map((row) => <option key={row.id} value={row.id}>{row.document.folio} · {row.client.isSystem ? "SYSTRON" : row.client.name} · saldo {money(row.balance)}</option>)}</select></Field></div>
          <Field label="Importe"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
          <Field label="Forma"><select name="method" className={controlClass} defaultValue="TRANSFERENCIA"><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option></select></Field>
          <Field label="Comprobante"><input name="receipt" required className={controlClass} /></Field>
          <Field label="Destino"><input name="destination" required className={controlClass} placeholder="Cuenta o caja" /></Field>
        </FormSection>
        <FormActions note="El estado final depende de los permisos del perfil que registra."><Button type="submit">Guardar pago</Button></FormActions>
      </FormPanel>
      {payables.length > 0 ? (
        <FormPanel action={intercompanyPaymentAction} className="mt-6">
          <FormSection title="Pago a Servomotores" description="Sale de una cuenta de SYSTRON. Servomotores confirma la entrada y puede ser parcial.">
            <div className="md:col-span-2"><Field label="Cuenta por pagar"><select name="payableId" required className={controlClass}>{payables.map((row) => <option key={row.id} value={row.id}>{row.document?.folio ?? "Compra"} · saldo {money(row.balance)}</option>)}</select></Field></div>
            <Field label="Importe"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
            <Field label="Comprobante"><input name="receipt" required className={controlClass} /></Field>
            <Field label="Cuenta de origen"><input name="destination" required className={controlClass} /></Field>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Registrar salida</Button></FormActions>
        </FormPanel>
      ) : null}
    </>
  );
}
