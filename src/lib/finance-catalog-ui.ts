export type FinanceCatalogClase = "ingreso" | "egreso" | "sub";

export type FinanceIncomeCatalog = { id: string; name: string };

export type FinanceExpenseCatalog = {
  id: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
};

export type VisibleFinanceCatalog =
  | { clase: "ingreso"; id: string; name: string }
  | {
      clase: "egreso";
      id: string;
      name: string;
      subcategories: Array<{ id: string; name: string }>;
    };

export type FinanceCatalogSelection =
  | { clase: "ingreso"; id: string; name: string }
  | { clase: "egreso"; id: string; name: string; subcategoryCount: number }
  | { clase: "sub"; id: string; name: string; categoryId: string };

function matches(query: string, parts: string[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return parts.some((part) => part.toLowerCase().includes(needle));
}

function visibleSubcategories(category: FinanceExpenseCatalog, q: string) {
  const needle = q.trim();
  if (!needle || matches(q, [category.name])) return category.subcategories;
  return category.subcategories.filter((subcategory) => matches(q, [subcategory.name]));
}

/** Expense subcategories stay inside their parent. They are never a sibling row. */
export function visibleFinanceCatalog(input: {
  incomes: FinanceIncomeCatalog[];
  expenses: FinanceExpenseCatalog[];
  q: string;
  tipo: string;
}): VisibleFinanceCatalog[] {
  const tipo = input.tipo === "ingreso" || input.tipo === "egreso" || input.tipo === "sub" ? input.tipo : "";
  const groups: VisibleFinanceCatalog[] = [];
  if (tipo !== "egreso" && tipo !== "sub") {
    for (const income of input.incomes) {
      if (matches(input.q, [income.name])) groups.push({ clase: "ingreso", id: income.id, name: income.name });
    }
  }
  if (tipo !== "ingreso") {
    for (const category of input.expenses) {
      const subcategories = visibleSubcategories(category, input.q);
      if (tipo === "sub") {
        if (subcategories.length === 0) continue;
        groups.push({ clase: "egreso", id: category.id, name: category.name, subcategories });
        continue;
      }
      const named = matches(input.q, [category.name]);
      if (!input.q.trim() || named || subcategories.length > 0) {
        groups.push({
          clase: "egreso",
          id: category.id,
          name: category.name,
          subcategories: named || !input.q.trim() ? category.subcategories : subcategories,
        });
      }
    }
  }
  return groups;
}

export function findFinanceCatalogSelection(
  incomes: FinanceIncomeCatalog[],
  expenses: FinanceExpenseCatalog[],
  selectedId?: string,
  selectedClase?: string,
): FinanceCatalogSelection | null {
  if (!selectedId) return null;
  if (selectedClase === "ingreso") {
    const income = incomes.find((item) => item.id === selectedId);
    return income ? { clase: "ingreso", id: income.id, name: income.name } : null;
  }
  if (selectedClase === "egreso") {
    const category = expenses.find((item) => item.id === selectedId);
    return category
      ? { clase: "egreso", id: category.id, name: category.name, subcategoryCount: category.subcategories.length }
      : null;
  }
  if (selectedClase === "sub") {
    for (const category of expenses) {
      const subcategory = category.subcategories.find((item) => item.id === selectedId);
      if (subcategory) return { clase: "sub", id: subcategory.id, name: subcategory.name, categoryId: category.id };
    }
  }
  return null;
}

export function financeCatalogDeleteBlockedMessage(
  clase: FinanceCatalogClase,
  name: string,
  usage: { purchases: number; movements: number },
): string | null {
  if (usage.purchases <= 0 && usage.movements <= 0) return null;
  const record = clase === "sub"
    ? `la subcategoría «${name}»`
    : clase === "ingreso"
      ? `la categoría de ingreso «${name}»`
      : `la categoría de egreso «${name}»`;
  const where = usage.purchases > 0 && usage.movements > 0
    ? "compras y movimientos financieros"
    : usage.purchases > 0
      ? "compras"
      : "movimientos financieros";
  return `No se puede eliminar ${record}: está en uso en ${where}.`;
}
