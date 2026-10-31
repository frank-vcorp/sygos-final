import { NewAccountDialog, NewCatalogDialog } from "./dialogs";
import { AccountsPanel } from "./accounts";
import { CatalogsPanel } from "./catalogs";
import { requireCeoConfig } from "../guard";
import { PageHeader, SegmentedNav } from "@/components/ui";
import { prisma } from "@/lib/db";

export default async function FinanzasConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; q?: string; tipo?: string; id?: string; clase?: string }>;
}) {
  const session = await requireCeoConfig();
  const sp = await searchParams;
  const vista = sp.vista === "catalogos" ? "catalogos" : "cuentas";
  const q = (sp.q ?? "").trim();
  const tipo = (sp.tipo ?? "").trim();
  const [accounts, incomes, expenses] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { companyId: session.activeCompanyId },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.incomeCategory.findMany({
      where: { companyId: session.activeCompanyId },
      orderBy: { name: "asc" },
    }),
    prisma.expenseCategory.findMany({
      where: { companyId: session.activeCompanyId },
      include: { subcategories: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const categories = expenses.map((category) => ({ id: category.id, name: category.name }));
  const catalogIncomes = incomes.map((row) => ({ id: row.id, name: row.name }));
  const catalogExpenses = expenses.map((category) => ({
    id: category.id,
    name: category.name,
    subcategories: category.subcategories.map((sub) => ({ id: sub.id, name: sub.name })),
  }));

  return (
    <>
      <PageHeader
        back={{ href: "/configuracion", label: "Configuración" }}
        title="Finanzas"
        subtitle={vista === "cuentas"
          ? `${session.activeCompanyName} · Cuentas bancarias y de efectivo. El saldo no se edita aquí.`
          : `${session.activeCompanyName} · Las subcategorías de egreso quedan dentro de su categoría.`}
        action={vista === "cuentas"
          ? <NewAccountDialog q={q || undefined} tipo={tipo || undefined} />
          : <NewCatalogDialog categories={categories} q={q || undefined} tipo={tipo || undefined} />}
      />
      <SegmentedNav
        items={[
          { href: "/configuracion/finanzas", label: "Cuentas", active: vista === "cuentas" },
          { href: "/configuracion/finanzas?vista=catalogos", label: "Catálogos", active: vista === "catalogos" },
        ]}
      />
      {vista === "cuentas" ? (
        <AccountsPanel accounts={accounts} q={q} tipo={tipo} selectedId={sp.id} />
      ) : (
        <CatalogsPanel
          incomes={catalogIncomes}
          expenses={catalogExpenses}
          q={q}
          tipo={tipo}
          selectedId={sp.id}
          selectedClase={sp.clase}
        />
      )}
    </>
  );
}
