export type ExpenseCategoryCatalogItem = {
  id: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
};

export function subcategoriesForExpenseCategory(
  categories: ExpenseCategoryCatalogItem[],
  categoryId: string,
): Array<{ id: string; name: string }> {
  if (!categoryId) return [];
  return categories.find((category) => category.id === categoryId)?.subcategories ?? [];
}

/** Clears subcategory when it does not belong to the newly selected category. */
export function reconcileExpenseSubcategoryId(
  categories: ExpenseCategoryCatalogItem[],
  categoryId: string,
  subcategoryId: string,
): string {
  if (!subcategoryId) return "";
  const valid = subcategoriesForExpenseCategory(categories, categoryId).some((sub) => sub.id === subcategoryId);
  return valid ? subcategoryId : "";
}
