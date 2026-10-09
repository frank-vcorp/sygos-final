import Link from "next/link";
import { redirect } from "next/navigation";
import { accountAction, movementAction, payCardAction, payPayableAction, proofAction, transferAction } from "./actions";
import { ActiveFilters, controlClass, Field, PageHeader, SegmentedNav } from "@/components/ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";

export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ mes?: string; vista?: string }> }) {
  const session = await requireCompany();
  if (!can(session.role, "finance.view", session.activeCompanyCode)) redirect("/inicio");
  const { mes, vista } = await searchParams;
  const focus = vista ?? "";
  const showSection = (section: string) => !focus || focus === section;
  const now = new Date();
  const key = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = key.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 6, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 6, 0, 0));
  const [accounts, movements, invoiced, collected, payables, receivables, pending] = await Promise.all([
    prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
    prisma.financeMovement.findMany({ where: { companyId: session.activeCompanyId, createdAt: { gte: start, lt: end } } }),
    prisma.billingDocument.aggregate({ where: { companyId: session.activeCompanyId, status: "EMITIDA", kind: { not: "REMISION" }, issuedAt: { gte: start, lt: end } }, _sum: { total: true } }),
    prisma.payment.aggregate({ where: { companyId: session.activeCompanyId, status: "VALIDADO", kind: "CLIENTE", createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.payable.aggregate({ where: { companyId: session.activeCompanyId, balance: { gt: 0 } }, _sum: { balance: true } }),
    prisma.receivable.aggregate({ where: { companyId: session.activeCompanyId, balance: { gt: 0 } }, _sum: { balance: true } }),
    prisma.financeMovement.findMany({ where: { companyId: session.activeCompanyId, pendingProof: true }, include: { account: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const openPayables = await prisma.payable.findMany({ where: { companyId: session.activeCompanyId, balance: { gt: 0 } }, include: { supplier: true, document: true }, take: 20 });
  const facturado = invoiced._sum.total ?? 0;
  const cobrado = collected._sum.amount ?? 0;
  const egresos = movements.filter((row) => row.direction === "EGRESO").reduce((sum, row) => sum + row.amount, 0);
  const ingresos = movements.filter((row) => row.direction === "INGRESO").reduce((sum, row) => sum + row.amount, 0);
  const cardDebt = accounts.filter((row) => row.kind === "TARJETA").reduce((sum, row) => sum + row.balance, 0);
  const banks = accounts.filter((row) => row.kind === "BANCO");
  const movementRows =
    focus === "ingresos"
      ? movements.filter((row) => row.direction === "INGRESO")
      : focus === "egresos"
        ? movements.filter((row) => row.direction === "EGRESO")
        : movements;
  const navItems = [
    { href: `/finanzas?mes=${key}`, label: "Resumen", active: !focus },
    { href: `/finanzas?vista=movimientos&mes=${key}`, label: "Movimientos", active: focus === "movimientos" || focus === "ingresos" || focus === "egresos" },
    { href: `/finanzas?vista=ingresos&mes=${key}`, label: "Ingresos", active: focus === "ingresos" },
    { href: `/finanzas?vista=egresos&mes=${key}`, label: "Egresos", active: focus === "egresos" },
    { href: `/finanzas?vista=transferencias&mes=${key}`, label: "Transferencias", active: focus === "transferencias" },
    { href: `/finanzas?vista=cuentas&mes=${key}`, label: "Cuentas", active: focus === "cuentas" },
    { href: `/finanzas?vista=cxp&mes=${key}`, label: "CxP", active: focus === "cxp" },
  ];
  const vistaLabel = navItems.find((item) => item.active && focus)?.label;
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return (
    <>
      <PageHeader title="Finanzas" subtitle={`${session.activeCompanyCode === "SERVOMOTORES" ? "Servomotores" : "SYSTRON"} · ${key}. No hay consolidado entre empresas.`} />
      <SegmentedNav items={navItems} />
      <ActiveFilters
        items={[
          ...(focus && vistaLabel ? [{ label: vistaLabel, clearHref: listHref("/finanzas", { mes: key !== defaultMes ? key : undefined }) }] : []),
          ...(key !== defaultMes ? [{ label: `Mes ${key}`, clearHref: listHref("/finanzas", { vista: focus || undefined }) }] : []),
        ]}
      />
      <form className="mb-4">
        <input name="mes" type="month" defaultValue={key} className="rounded-md border border-[var(--line)] px-3 py-2 text-sm" />
        {focus ? <input type="hidden" name="vista" value={focus} /> : null}
        <button className="ml-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm">Ver mes</button>
      </form>
      {showSection("dashboard") ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/facturacion" className="rounded-lg border border-[var(--line)] bg-white p-4"><p className="text-sm text-[var(--muted)]">Facturado</p><p className="text-xl font-medium">{money(facturado)}</p></Link>
        <Link href="/pagos" className="rounded-lg border border-[var(--line)] bg-white p-4"><p className="text-sm text-[var(--muted)]">Cobrado</p><p className="text-xl font-medium">{money(cobrado)}</p></Link>
        <Link href="/compras" className="rounded-lg border border-[var(--line)] bg-white p-4"><p className="text-sm text-[var(--muted)]">Egresos</p><p className="text-xl font-medium">{money(egresos)}</p></Link>
        <div className="rounded-lg border border-[var(--line)] bg-white p-4"><p className="text-sm text-[var(--muted)]">Utilidad sobre facturación</p><p className="text-xl font-medium">{money(facturado - egresos)}</p><p className="text-xs text-[var(--muted)]">Flujo de movimientos {money(ingresos - egresos)}</p></div>
      </div> : null}
      {(showSection("movimientos") || showSection("ingresos") || showSection("egresos")) && movementRows.length > 0 ? (
        <section className="mt-4 rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
          <h2 className="font-medium">Movimientos del mes</h2>
          <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {movementRows.map((row) => (
              <li key={row.id}>{row.direction} · {money(row.amount)} · {row.note ?? row.category}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {showSection("dashboard") ? <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div id="fin-cuentas" className="rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
          <h2 className="font-medium">Cuentas</h2>
          <ul className="mt-2 space-y-1">{accounts.map((row) => <li key={row.id}>{row.name} · {row.kind === "TARJETA" ? "deuda" : "saldo"} {money(row.balance)}</li>)}</ul>
          <p className="mt-2">CxC {money(receivables._sum.balance ?? 0)} · CxP {money(payables._sum.balance ?? 0)} · Tarjetas {money(cardDebt)}</p>
        </div>
        <form action={movementAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Movimiento manual</h2>
          <Field label="Cuenta"><select name="accountId" className={controlClass}>{accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
          <Field label="Dirección"><select name="direction" className={controlClass}><option value="EGRESO">Egreso</option><option value="INGRESO">Ingreso</option></select></Field>
          <Field label="Importe"><input name="amount" type="number" min="0.01" step="0.01" required className={controlClass} /></Field>
          <Field label="Categoría"><input name="category" required className={controlClass} /></Field>
          <Field label="Nota"><input name="note" required className={controlClass} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pendingProof" value="si" /> Pendiente de comprobación</label>
          <button className="w-fit rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Registrar</button>
        </form>
      </section> : null}
      {showSection("cuentas") && !showSection("dashboard") ? (
        <div id="fin-cuentas" className="mt-4 rounded-lg border border-[var(--line)] bg-white p-4 text-sm">
          <h2 className="font-medium">Cuentas</h2>
          <ul className="mt-2 space-y-1">{accounts.map((row) => <li key={row.id}>{row.name} · {row.kind === "TARJETA" ? "deuda" : "saldo"} {money(row.balance)}</li>)}</ul>
          <p className="mt-2">CxC {money(receivables._sum.balance ?? 0)} · CxP {money(payables._sum.balance ?? 0)} · Tarjetas {money(cardDebt)}</p>
        </div>
      ) : null}
      {(showSection("movimientos") || showSection("ingresos") || showSection("egresos")) && !showSection("dashboard") ? (
        <form action={movementAction} className="mt-4 grid max-w-xl gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Movimiento manual</h2>
          <Field label="Cuenta"><select name="accountId" className={controlClass}>{accounts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
          <Field label="Dirección"><select name="direction" className={controlClass}><option value="EGRESO">Egreso</option><option value="INGRESO">Ingreso</option></select></Field>
          <Field label="Importe"><input name="amount" type="number" min="0.01" step="0.01" required className={controlClass} /></Field>
          <Field label="Categoría"><input name="category" required className={controlClass} /></Field>
          <Field label="Nota"><input name="note" required className={controlClass} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="pendingProof" value="si" /> Pendiente de comprobación</label>
          <button className="w-fit rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">Registrar</button>
        </form>
      ) : null}
      {showSection("dashboard") && pending.length > 0 ? (
        <section className="mt-4 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Pendientes de comprobación</h2>
          {pending.map((row) => (
            <form key={row.id} action={proofAction} className="mt-2 flex flex-wrap items-end gap-2 text-sm">
              <input type="hidden" name="movementId" value={row.id} />
              <span>{row.account.name} · {money(row.amount)} · {row.note}</span>
              <input name="proofNote" required placeholder="Factura o comprobante" className={controlClass} />
              <button className="rounded-md border border-[var(--line)] px-3 py-2">Relacionar</button>
            </form>
          ))}
        </section>
      ) : null}
      {(showSection("cuentas") || showSection("dashboard")) ? <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <form action={accountAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Nueva cuenta</h2>
          <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
          <Field label="Tipo"><select name="kind" className={controlClass}><option value="BANCO">Banco</option><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option></select></Field>
          <Field label="Saldo o deuda inicial"><input name="opening" type="number" step="0.01" defaultValue="0" className={controlClass} /></Field>
          <button className="w-fit rounded-md border border-[var(--line)] px-3 py-2 text-sm">Guardar cuenta</button>
        </form>
        {showSection("transferencias") || showSection("dashboard") ? <form action={transferAction} className="grid gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Transferencia entre bancos</h2>
          <Field label="Desde"><select name="fromId" className={controlClass}>{banks.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
          <Field label="Hacia"><select name="toId" className={controlClass}>{banks.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
          <Field label="Importe"><input name="amount" type="number" min="0.01" step="0.01" required className={controlClass} /></Field>
          <button className="w-fit rounded-md border border-[var(--line)] px-3 py-2 text-sm">Transferir</button>
        </form> : null}
      </section> : null}
      {showSection("dashboard") && accounts.some((row) => row.kind === "TARJETA" && row.balance > 0) ? (
        <form action={payCardAction} className="mt-4 grid max-w-xl gap-2 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Pagar tarjeta</h2>
          <Field label="Tarjeta"><select name="cardId" className={controlClass}>{accounts.filter((row) => row.kind === "TARJETA").map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
          <Field label="Banco"><select name="bankId" className={controlClass}>{banks.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></Field>
          <Field label="Importe"><input name="amount" type="number" min="0.01" step="0.01" required className={controlClass} /></Field>
          <button className="w-fit rounded-md border border-[var(--line)] px-3 py-2 text-sm">Abonar</button>
        </form>
      ) : null}
      {(showSection("cxp") || showSection("dashboard")) && openPayables.length > 0 ? (
        <section className="mt-4 rounded-lg border border-[var(--line)] bg-white p-4">
          <h2 className="font-medium">Pagar cuenta por pagar</h2>
          {openPayables.map((row) => (
            <form key={row.id} action={payPayableAction} className="mt-2 flex flex-wrap items-end gap-2 text-sm">
              <input type="hidden" name="payableId" value={row.id} />
              <span>{row.document?.folio ?? "Compra"} · {row.supplier.name} · saldo {money(row.balance)}</span>
              <select name="accountId" className={controlClass}>{accounts.filter((account) => account.kind !== "TARJETA").map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
              <input name="amount" type="number" min="0.01" step="0.01" required placeholder="Importe" className="w-28 rounded-md border border-[var(--line)] px-2 py-2" />
              <button className="rounded-md border border-[var(--line)] px-3 py-2">Pagar</button>
            </form>
          ))}
        </section>
      ) : null}
    </>
  );
}
