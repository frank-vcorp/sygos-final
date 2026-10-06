import { redirect } from "next/navigation";
import { intercompanyPaymentAction, registerPaymentAction } from "../actions";
import { controlClass, Field, PageHeader } from "@/components/ui";
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
      <form action={registerPaymentAction} className="grid max-w-xl gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
        <Field label="Cuenta por cobrar">
          <select name="receivableId" required className={controlClass} defaultValue="">
            <option value="">Selecciona</option>
            {receivables.map((row) => <option key={row.id} value={row.id}>{row.document.folio} · {row.client.isSystem ? "SYSTRON" : row.client.name} · saldo {money(row.balance)}</option>)}
          </select>
        </Field>
        <Field label="Importe"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
        <Field label="Forma">
          <select name="method" className={controlClass} defaultValue="TRANSFERENCIA">
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="EFECTIVO">Efectivo</option>
          </select>
        </Field>
        <Field label="Comprobante"><input name="receipt" required className={controlClass} /></Field>
        <Field label="Destino"><input name="destination" required className={controlClass} placeholder="Cuenta o caja" /></Field>
        <button className="w-fit rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Guardar pago</button>
      </form>
      {payables.length > 0 ? (
        <form action={intercompanyPaymentAction} className="mt-4 grid max-w-xl gap-3 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Pago a Servomotores</h2>
          <p className="text-sm text-[var(--muted)]">Sale de una cuenta de SYSTRON. Servomotores confirma la entrada. Puede ser parcial.</p>
          <Field label="Cuenta por pagar">
            <select name="payableId" required className={controlClass}>
              {payables.map((row) => <option key={row.id} value={row.id}>{row.document.folio} · saldo {money(row.balance)}</option>)}
            </select>
          </Field>
          <Field label="Importe"><input name="amount" required type="number" min="0.01" step="0.01" className={controlClass} /></Field>
          <Field label="Comprobante"><input name="receipt" required className={controlClass} /></Field>
          <Field label="Cuenta de origen"><input name="destination" required className={controlClass} /></Field>
          <button className="w-fit rounded-md border border-[var(--line)] px-3 py-2 text-sm">Registrar salida</button>
        </form>
      ) : null}
    </>
  );
}
