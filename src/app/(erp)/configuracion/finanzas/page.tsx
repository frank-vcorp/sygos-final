import { NewAccountDialog, NewCatalogDialog } from "./dialogs";
import { AccountsPanel } from "./accounts";
import { CatalogsPanel, type CatalogRow } from "./catalogs";
import { readEstado } from "../filters";
import { requireCeoConfig } from "../guard";
import { PageHeader, SegmentedNav } from "@/components/ui";
import { prisma } from "@/lib/db";

export default async function FinanzasConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; q?: string; tipo?: string; estado?: string; id?: string; clase?: string }>;
}) {
  const session = await requireCeoConfig();
  const sp = await searchParams;
  const vista = sp.vista === "catalogos" ? "catalogos" : "cuentas";
  const q = (sp.q ?? "").trim();
  const tipo = (sp.tipo ?? "").trim();
  const estado = readEstado(sp.estado);
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
  const catalogRows: CatalogRow[] = [
    ...incomes.map((row) => ({
      id: row.id,
      clase: "ingreso" as const,
      name: row.name,
      active: row.active,
      categoryId: null,
      categoryName: null,
    })),
    ...expenses.flatMap((category) => [
      {
        id: category.id,
        clase: "egreso" as const,
        name: category.name,
        active: category.active,
        categoryId: null,
        categoryName: null,
      },
      ...category.subcategories.map((sub) => ({
        id: sub.id,
        clase: "sub" as const,
        name: sub.name,
        active: sub.active,
        categoryId: category.id,
        categoryName: category.name,
      })),
    ]),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/configuracion", label: "Configuración" }}
        title="Finanzas"
        subtitle={vista === "cuentas"
          ? `${session.activeCompanyName} · Cuentas bancarias y de efectivo. El saldo no se edita aquí.`
          : `${session.activeCompanyName} · Ingresos, egresos y subcategorías en la misma lista.`}
        action={vista === "cuentas"
          ? <NewAccountDialog q={q || undefined} tipo={tipo || undefined} />
          : <NewCatalogDialog categories={categories} q={q || undefined} tipo={tipo || undefined} estado={estado === "todos" ? undefined : estado} />}
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
          rows={catalogRows}
          categories={categories}
          q={q}
          tipo={tipo}
          estado={estado}
          selectedId={sp.id}
          selectedClase={sp.clase}
        />
      )}
    </>
  );
}
