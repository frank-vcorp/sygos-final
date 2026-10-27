"use client";

import { useMemo, useState } from "react";
import {
  type ExpenseCategoryCatalogItem,
  reconcileExpenseSubcategoryId,
  subcategoriesForExpenseCategory,
} from "@/lib/expense-catalog";
import { controlClass, Field } from "@/components/ui";

export function ExpenseCategorySubcategoryFields({
  categories,
  categoryLabel = "Categoría de egreso",
  subcategoryLabel = "Subcategoría",
  required = true,
  initialCategoryId = "",
  initialSubcategoryId = "",
}: {
  categories: ExpenseCategoryCatalogItem[];
  categoryLabel?: string;
  subcategoryLabel?: string;
  required?: boolean;
  initialCategoryId?: string;
  initialSubcategoryId?: string;
}) {
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId);

  const visibleSubcategories = useMemo(
    () => subcategoriesForExpenseCategory(categories, categoryId),
    [categories, categoryId],
  );

  function onCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setSubcategoryId((current) => reconcileExpenseSubcategoryId(categories, nextCategoryId, current));
  }

  return (
    <>
      <Field label={categoryLabel}>
        <select
          name="expenseCategoryId"
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
          required={required}
          className={controlClass}
        >
          <option value="" disabled>Selecciona una categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
      </Field>
      <Field label={subcategoryLabel}>
        <select
          name="expenseSubcategoryId"
          value={subcategoryId}
          onChange={(event) => setSubcategoryId(event.target.value)}
          className={controlClass}
          disabled={!categoryId}
        >
          <option value="">Sin subcategoría</option>
          {visibleSubcategories.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
          ))}
        </select>
      </Field>
    </>
  );
}
