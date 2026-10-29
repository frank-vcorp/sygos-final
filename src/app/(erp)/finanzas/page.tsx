import { redirect } from "next/navigation";
import { accountAction, payCardAction, payPayableAction, proofAction, transferAction } from "./actions";
import { FinanzasMesFilter } from "@/components/compact-list-filters";
import {
  ActiveFilters,
  Badge,
  Button,
  Card,
  controlClass,
  Empty,
  Field,
  FormActions,
  FormPanel,
  FormSection,
  KpiCard,
  MoneyInput,
  MobileCard,
  PageHeader,
  ResponsiveData,
  SegmentedNav,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { coordFilterChips, coordPageSubtitle, coordPageTitle, coordUsesSidebarNav } from "@/lib/coordination-ui";
import { listHref } from "@/lib/list-url";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";
import { can } from "@/lib/permissions";
import { requireCompany } from "@/lib/session";
import { ManualMovementForm } from "./manual-movement-form";

type FinanceAccountRow = { id: string; name: string; kind: string; balance: number };

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
  const [accounts, movements, invoiced, collected, payables, receivables, pending, expenseCategories, incomeCategories] = await Promise.all([
    prisma.financeAccount.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
    prisma.financeMovement.findMany({ where: { companyId: session.activeCompanyId, createdAt: { gte: start, lt: end } } }),
    prisma.billingDocument.aggregate({ where: { companyId: session.activeCompanyId, status: "EMITIDA", kind: { not: "REMISION" }, issuedAt: { gte: start, lt: end } }, _sum: { total: true } }),
    prisma.payment.aggregate({ where: { companyId: session.activeCompanyId, status: "VALIDADO", kind: "CLIENTE", createdAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.payable.aggregate({ where: { companyId: session.activeCompanyId, balance: { gt: 0 } }, _sum: { balance: true } }),
    prisma.receivable.aggregate({ where: { companyId: session.activeCompanyId, balance: { gt: 0 } }, _sum: { balance: true } }),
    prisma.financeMovement.findMany({ where: { companyId: session.activeCompanyId, pendingProof: true }, include: { account: true }, orderBy: { createdAt: "desc" } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, include: { subcategories: { where: { active: true } } }, orderBy: { name: "asc" } }),
    prisma.incomeCategory.findMany({ where: { companyId: session.activeCompanyId, active: true }, orderBy: { name: "asc" } }),
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
  const movementDirectionMode =
    focus === "ingresos" ? "ingreso" as const
      : focus === "egresos" ? "egreso" as const
        : "both" as const;
  const navItems = [
    { href: `/finanzas?mes=${key}`, label: "Resumen", active: !focus },
    { href: `/finanzas?vista=movimientos&mes=${key}`, label: "Movimientos", active: focus === "movimientos" },
    { href: `/finanzas?vista=ingresos&mes=${key}`, label: "Ingresos", active: focus === "ingresos" },
    { href: `/finanzas?vista=egresos&mes=${key}`, label: "Egresos", active: focus === "egresos" },
    { href: `/finanzas?vista=transferencias&mes=${key}`, label: "Transferencias", active: focus === "transferencias" },
    { href: `/finanzas?vista=cuentas&mes=${key}`, label: "Cuentas", active: focus === "cuentas" },
    { href: `/finanzas?vista=cxp&mes=${key}`, label: "CxP", active: focus === "cxp" },
  ];
  const vistaLabel = navItems.find((item) => item.active && focus)?.label;
  const defaultMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const cxc = receivables._sum.balance ?? 0;
  const cxp = payables._sum.balance ?? 0;
  const sidebarNav = coordUsesSidebarNav(session.role);
  const pageTitle = coordPageTitle(sidebarNav, vistaLabel && focus ? vistaLabel : undefined, "Finanzas");
  const pageSubtitle = coordPageSubtitle(
    sidebarNav,
    session.activeCompanyCode,
    `${session.activeCompanyCode === "SERVOMOTORES" ? "Servomotores" : "SYSTRON"} · ${key}. No hay consolidado entre empresas.`,
    focus ? `mes ${key}` : `${key}. Resumen del mes`,
  );
  return (
    <>
      <PageHeader title={pageTitle} subtitle={pageSubtitle} />
      {sidebarNav ? null : <SegmentedNav items={navItems} />}
      <ActiveFilters
        items={[
          ...coordFilterChips(sidebarNav, focus && vistaLabel ? [{ label: vistaLabel, clearHref: listHref("/finanzas", { mes: key !== defaultMes ? key : undefined }) }] : []),
          ...(key !== defaultMes ? [{ label: `Mes ${key}`, clearHref: listHref("/finanzas", { vista: focus || undefined }) }] : []),
        ]}
      />
      <FinanzasMesFilter mes={key} vista={focus} />
      {showSection("dashboard") ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Facturado" value={money(facturado)} href="/facturacion" />
          <KpiCard label="Cobrado" value={money(cobrado)} href="/pagos" />
          <KpiCard label="Egresos del mes" value={money(egresos)} href="/compras" />
          <KpiCard label="Utilidad sobre facturación" value={money(facturado - egresos)} />
        </div>
      ) : null}
      {showSection("dashboard") ? (
        <p className="mt-2 text-sm text-[var(--muted)]">Flujo de movimientos del mes: {money(ingresos - egresos)}</p>
      ) : null}
      {(showSection("movimientos") || showSection("ingresos") || showSection("egresos")) && !showSection("dashboard") ? (
        <ManualMovementForm
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          directionMode={movementDirectionMode}
          className="mt-4 max-w-none"
        />
      ) : null}
      {(showSection("movimientos") || showSection("ingresos") || showSection("egresos")) && movementRows.length === 0 ? (
        <Empty title="Sin movimientos en el mes" body="Registra un ingreso o egreso manual o espera movimientos de operación." />
      ) : null}
      {(showSection("movimientos") || showSection("ingresos") || showSection("egresos")) && movementRows.length > 0 ? (
        <ResponsiveData
          table={
            <Table>
              <thead>
                <tr>
                  <Th>Tipo</Th>
                  <Th>Importe</Th>
                  <Th>Concepto</Th>
                </tr>
              </thead>
              <tbody>
                {movementRows.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Badge tone={row.direction === "INGRESO" ? "ok" : "warn"}>
                        {row.direction === "INGRESO" ? "Ingreso" : "Egreso"}
                      </Badge>
                    </Td>
                    <Td>{money(row.amount)}</Td>
                    <Td>{row.note ?? row.category}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          }
          cards={movementRows.map((row) => (
            <MobileCard
              key={row.id}
              title={row.direction === "INGRESO" ? "Ingreso" : "Egreso"}
              meta={<Badge tone={row.direction === "INGRESO" ? "ok" : "warn"}>{money(row.amount)}</Badge>}
            >
              <p>{row.note ?? row.category}</p>
            </MobileCard>
          ))}
        />
      ) : null}
      {showSection("dashboard") ? (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div id="fin-cuentas" className="scroll-mt-28">
            <AccountsSummary accounts={accounts} cxc={cxc} cxp={cxp} cardDebt={cardDebt} />
          </div>
          <ManualMovementForm
            accounts={accounts}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            directionMode="both"
            className="max-w-none"
          />
        </section>
      ) : null}
      {showSection("cuentas") && !showSection("dashboard") ? (
        <div id="fin-cuentas" className="mt-4 scroll-mt-28">
          <AccountsSummary accounts={accounts} cxc={cxc} cxp={cxp} cardDebt={cardDebt} />
        </div>
      ) : null}
      {showSection("dashboard") && pending.length > 0 ? (
        <Card className="mt-4 p-4">
          <h2 className="font-medium">Pendientes de comprobación</h2>
          <ul className="mt-3 space-y-3">
            {pending.map((row) => (
              <li key={row.id}>
                <FormPanel action={proofAction}>
                  <input type="hidden" name="movementId" value={row.id} />
                  <FormSection title={`${row.account.name} · ${money(row.amount)}`} description={row.note ?? undefined} columns={1}>
                    <Field label="Factura o comprobante">
                      <input name="proofNote" required placeholder="Referencia del comprobante" className={controlClass} />
                    </Field>
                  </FormSection>
                  <FormActions><Button type="submit" tone="ghost">Relacionar</Button></FormActions>
                </FormPanel>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {(showSection("cuentas") || showSection("dashboard")) ? (
        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <FormPanel action={accountAction}>
            <FormSection title="Nueva cuenta" description="Banco, efectivo o tarjeta con saldo o deuda inicial.">
              <Field label="Nombre"><input name="name" required className={controlClass} /></Field>
              <Field label="Tipo">
                <select name="kind" className={controlClass}>
                  <option value="BANCO">Banco</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </Field>
              <Field label="Saldo o deuda inicial"><MoneyInput name="opening" defaultValue="0" /></Field>
            </FormSection>
            <FormActions><Button type="submit" tone="ghost">Guardar cuenta</Button></FormActions>
          </FormPanel>
          {showSection("transferencias") || showSection("dashboard") ? (
            <FormPanel action={transferAction}>
              <FormSection title="Transferencia entre bancos" description="Mueve saldo entre cuentas de tipo banco." columns={1}>
                <Field label="Desde">
                  <select name="fromId" className={controlClass}>{banks.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
                </Field>
                <Field label="Hacia">
                  <select name="toId" className={controlClass}>{banks.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
                </Field>
                <Field label="Importe"><MoneyInput name="amount" min="0.01" required /></Field>
              </FormSection>
              <FormActions><Button type="submit" tone="ghost">Transferir</Button></FormActions>
            </FormPanel>
          ) : null}
        </section>
      ) : null}
      {showSection("dashboard") && accounts.some((row) => row.kind === "TARJETA" && row.balance > 0) ? (
        <FormPanel action={payCardAction} className="mt-4 max-w-xl">
          <FormSection title="Pagar tarjeta" description="Abono desde una cuenta banco hacia la deuda de tarjeta.">
            <Field label="Tarjeta">
              <select name="cardId" className={controlClass}>{accounts.filter((row) => row.kind === "TARJETA").map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            </Field>
            <Field label="Banco">
              <select name="bankId" className={controlClass}>{banks.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
            </Field>
            <Field label="Importe"><MoneyInput name="amount" min="0.01" required /></Field>
          </FormSection>
          <FormActions><Button type="submit" tone="ghost">Abonar</Button></FormActions>
        </FormPanel>
      ) : null}
      {(showSection("cxp") || showSection("dashboard")) && openPayables.length > 0 ? (
        <Card className="mt-4 p-4">
          <h2 className="font-medium">Pagar cuenta por pagar</h2>
          <ul className="mt-3 space-y-3">
            {openPayables.map((row) => (
              <li key={row.id}>
                <FormPanel action={payPayableAction}>
                  <input type="hidden" name="payableId" value={row.id} />
                  <FormSection
                    title={row.document?.folio ?? "Compra"}
                    description={`${row.supplier.name} · saldo ${money(row.balance)}`}
                  >
                    <Field label="Cuenta">
                      <select name="accountId" className={controlClass}>
                        {accounts.filter((account) => account.kind !== "TARJETA").map((account) => (
                          <option key={account.id} value={account.id}>{account.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Importe"><MoneyInput name="amount" min="0.01" required /></Field>
                  </FormSection>
                  <FormActions><Button type="submit" tone="ghost">Pagar</Button></FormActions>
                </FormPanel>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
function AccountsSummary({
  accounts,
  cxc,
  cxp,
  cardDebt,
  className = "",
}: {
  accounts: FinanceAccountRow[];
  cxc: number;
  cxp: number;
  cardDebt: number;
  className?: string;
}) {
  return (
    <Card className={`scroll-mt-28 p-4 text-sm ${className}`}>
      <h2 className="font-medium">Cuentas</h2>
      <ul className="mt-2 space-y-1">
        {accounts.map((row) => (
          <li key={row.id}>{row.name} · {row.kind === "TARJETA" ? "deuda" : "saldo"} {money(row.balance)}</li>
        ))}
      </ul>
      <p className="mt-2">CxC {money(cxc)} · CxP {money(cxp)} · Tarjetas {money(cardDebt)}</p>
    </Card>
  );
}
