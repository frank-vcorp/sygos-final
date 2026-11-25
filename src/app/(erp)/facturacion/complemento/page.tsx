import { redirect } from "next/navigation";
import { stampMultiInvoiceComplementAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormActions, FormPanel, PageHeader, controlClass } from "@/components/ui";
import { prisma } from "@/lib/db";
import { homePath } from "@/lib/home";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function ComplementoVariasFacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const session = await requireCompany();
  if (!can(session.role, "invoice.issue", session.activeCompanyCode)) {
    redirect(homePath(session.role, session.activeCompanyCode));
  }
  const { cliente } = await searchParams;
  const eligibleWhere = {
    companyId: session.activeCompanyId,
    status: "EMITIDA" as const,
    paymentMethodSnapshot: "PPD",
    fiscalStatus: "TIMBRADA",
    kind: { notIn: ["REMISION", "NOTA_CREDITO"] },
    receivable: { balance: { gt: 0 } },
  };
  const [clients, invoices] = await Promise.all([
    prisma.billingDocument.findMany({
      where: eligibleWhere,
      distinct: ["clientId"],
      select: { client: { select: { id: true, name: true } } },
      orderBy: { client: { name: "asc" } },
    }),
    cliente
      ? prisma.billingDocument.findMany({
          where: { ...eligibleWhere, clientId: cliente },
          include: { receivable: true },
          orderBy: { folio: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const clientOptions = clients.map((row) => row.client);

  return (
    <>
      <PageHeader
        title="Complemento de varias facturas"
        subtitle="Un solo REP para facturas PPD del mismo cliente que todavía tienen saldo. El complemento de una factura sigue en el pago."
        back={{ href: "/facturacion?vista=facturas", label: "Facturación" }}
      />
      <div className="max-w-5xl rounded-xl border border-slate-200/80 bg-white">
        <form method="get" className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="Cliente">
            <select name="cliente" defaultValue={cliente ?? ""} className={controlClass} required>
              <option value="">Selecciona</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </Field>
          <button type="submit" className="min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-medium">
            Ver facturas
          </button>
        </form>
      </div>
      {cliente ? (
        <FormPanel action={stampMultiInvoiceComplementAction} className="mt-4">
          <div className="grid gap-4 p-5">
            <input type="hidden" name="clientId" value={cliente} />
            {invoices.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Este cliente no tiene facturas PPD timbradas con saldo.</p>
            ) : (
              <ul className="grid gap-3">
                {invoices.map((invoice) => (
                  <li key={invoice.id} className="rounded-lg border border-[var(--line)] p-3">
                    <label className="flex items-start gap-3">
                      <input type="checkbox" name="documentId" value={invoice.id} className="mt-1" />
                      <span className="text-sm">
                        <span className="font-medium">{invoice.folio}</span>
                        <span className="block text-[var(--muted)]">
                          Saldo pendiente: {money(invoice.receivable?.balance ?? 0)} · Total {money(invoice.total)}
                        </span>
                      </span>
                    </label>
                    <label className="mt-2 block text-sm">
                      <span className="mb-1 block text-xs font-semibold">Importe de este pago</span>
                      <input
                        name={`amount_${invoice.id}`}
                        defaultValue={invoice.receivable?.balance ?? ""}
                        inputMode="decimal"
                        className={controlClass}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Medio">
                <select name="method" className={controlClass} defaultValue="TRANSFERENCIA" required>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="EFECTIVO">Efectivo</option>
                </select>
              </Field>
              <Field label="Comprobante">
                <input name="receipt" required className={controlClass} placeholder="Referencia del depósito" />
              </Field>
              <Field label="Destino">
                <input name="destination" required className={controlClass} placeholder="Cuenta que recibe" />
              </Field>
            </div>
          </div>
          <FormActions note="El saldo de cada factura baja por el importe elegido. PPD no las deja pagadas si queda saldo.">
            <SubmitButton pendingLabel="Timbrando…">Timbrar complemento</SubmitButton>
          </FormActions>
        </FormPanel>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">Elige el cliente para marcar las facturas que cubre el complemento.</p>
      )}
    </>
  );
}
