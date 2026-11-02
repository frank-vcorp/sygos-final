"use client";

import { Fragment } from "react";
import { deleteFinanceCatalogAction, saveExpenseCategoryAction, saveExpenseSubcategoryAction, saveIncomeCategoryAction } from "../ceo-actions";
import { ConfigEditDialog } from "../edit-dialog";
import { ConfirmSubmit } from "@/components/submit-button";
import {
  visibleFinanceCatalog,
  type FinanceCatalogClase,
  type FinanceCatalogSelection,
  type FinanceExpenseCatalog,
  type FinanceIncomeCatalog,
} from "@/lib/finance-catalog-ui";
import { HiddenFields } from "../pieces";
import {
  ActiveFilters,
  Button,
  controlClass,
  Empty,
  Field,
  FilterBar,
  FormActions,
  FormPanel,
  FormSection,
  MobileCard,
  ResponsiveData,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { listHref } from "@/lib/list-url";

const CLASE_LABEL: Record<FinanceCatalogClase, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  sub: "Subcategoría",
};

function catalogEditTitle(row: FinanceCatalogSelection) {
  if (row.clase === "ingreso") return `Editar ingreso · ${row.name}`;
  if (row.clase === "egreso") return `Editar egreso · ${row.name}`;
  return `Editar subcategoría · ${row.name}`;
}

function catalogRowFromGroup(
  group: ReturnType<typeof visibleFinanceCatalog>[number],
  subcategory?: { id: string; name: string },
): FinanceCatalogSelection {
  if (group.clase === "ingreso") return { clase: "ingreso", id: group.id, name: group.name };
  if (subcategory) return { clase: "sub", id: subcategory.id, name: subcategory.name, categoryId: group.id };
  return { clase: "egreso", id: group.id, name: group.name, subcategoryCount: group.subcategories.length };
}

export function CatalogsPanel({
  incomes,
  expenses,
  q,
  tipo,
}: {
  incomes: FinanceIncomeCatalog[];
  expenses: FinanceExpenseCatalog[];
  q: string;
  tipo: string;
}) {
  const clase = tipo === "ingreso" || tipo === "egreso" || tipo === "sub" ? tipo : "";
  const visible = visibleFinanceCatalog({ incomes, expenses, q, tipo: clase });
  const hasCatalog = incomes.length > 0 || expenses.length > 0;

  return (
    <>
      <FilterBar action="/configuracion/finanzas">
        <input type="hidden" name="vista" value="catalogos" />
        <input name="q" defaultValue={q} placeholder="Nombre" className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} />
        <select name="tipo" defaultValue={clase} className={`${controlClass} sm:w-auto`} aria-label="Tipo">
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
          <option value="sub">Subcategorías</option>
        </select>
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(clase ? [{ label: CLASE_LABEL[clase], clearHref: listHref("/configuracion/finanzas", { vista: "catalogos", q: q || undefined }) }] : []),
          ...(q ? [{ label: `Búsqueda: ${q}`, clearHref: listHref("/configuracion/finanzas", { vista: "catalogos", tipo: clase || undefined }) }] : []),
        ]}
      />
      {!hasCatalog ? (
        <Empty title="Sin catálogos" body="Agrega categorías de ingreso o egreso con el botón del encabezado." />
      ) : visible.length === 0 ? (
        <Empty title="Sin coincidencias" body="Ningún concepto coincide con el filtro." />
      ) : (
        <ResponsiveData
          table={
            <Table stickyHeader>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Tipo</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((group) => {
                  if (group.clase === "ingreso") {
                    const row = catalogRowFromGroup(group);
                    return (
                      <tr key={`ingreso-${group.id}`}>
                        <Td className="font-semibold text-slate-900">{group.name}</Td>
                        <Td>Ingreso</Td>
                        <Td>
                          <CatalogEditButton row={row} categories={expenses} q={q} tipo={clase} />
                        </Td>
                      </tr>
                    );
                  }
                  return (
                    <Fragment key={`egreso-${group.id}`}>
                      <tr>
                        <Td className="font-semibold text-slate-900">{group.name}</Td>
                        <Td>Egreso</Td>
                        <Td>
                          <CatalogEditButton row={catalogRowFromGroup(group)} categories={expenses} q={q} tipo={clase} />
                        </Td>
                      </tr>
                      {group.subcategories.map((subcategory) => {
                        const row = catalogRowFromGroup(group, subcategory);
                        return (
                          <tr key={`sub-${subcategory.id}`}>
                            <Td>
                              <span className="flex items-center gap-2 pl-5">
                                <span aria-hidden className="text-slate-400">↳</span>
                                <span className="font-semibold text-slate-900">
                                  <span className="sr-only">Subcategoría de {group.name}: </span>
                                  {subcategory.name}
                                </span>
                              </span>
                            </Td>
                            <Td>Subcategoría</Td>
                            <Td>
                              <CatalogEditButton row={row} categories={expenses} q={q} tipo={clase} />
                            </Td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </Table>
          }
          cards={visible.map((group) => {
            if (group.clase === "ingreso") {
              const row = catalogRowFromGroup(group);
              return (
                <MobileCard
                  key={`ingreso-${group.id}`}
                  title={group.name}
                  meta="Ingreso"
                  footer={
                    <div className="flex justify-end">
                      <CatalogEditButton row={row} categories={expenses} q={q} tipo={clase} mobile />
                    </div>
                  }
                />
              );
            }
            return (
              <MobileCard
                key={`egreso-${group.id}`}
                title={group.name}
                meta="Egreso"
                footer={(
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <CatalogEditButton row={catalogRowFromGroup(group)} categories={expenses} q={q} tipo={clase} mobile />
                    </div>
                    {group.subcategories.length ? (
                      <ul className="space-y-2 border-t border-slate-200/80 pt-3">
                        {group.subcategories.map((subcategory) => {
                          const row = catalogRowFromGroup(group, subcategory);
                          return (
                            <li key={subcategory.id} className="flex items-center justify-between gap-2 border-l border-slate-300 pl-3">
                              <div>
                                <p className="font-semibold text-slate-900">{subcategory.name}</p>
                                <p className="text-xs text-slate-500">Subcategoría</p>
                              </div>
                              <CatalogEditButton row={row} categories={expenses} q={q} tipo={clase} mobile />
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                )}
              />
            );
          })}
        />
      )}
    </>
  );
}

function CatalogEditButton({
  row,
  categories,
  q,
  tipo,
  mobile,
}: {
  row: FinanceCatalogSelection;
  categories: FinanceExpenseCatalog[];
  q: string;
  tipo: string;
  mobile?: boolean;
}) {
  const title = catalogEditTitle(row);
  const titleId = `editar-catalogo-${row.clase}-${row.id}${mobile ? "-m" : ""}`;
  return (
    <ConfigEditDialog title={title} titleId={titleId}>
      <CatalogEditor row={row} categories={categories} q={q} tipo={tipo} />
    </ConfigEditDialog>
  );
}

function deleteConfirm(row: FinanceCatalogSelection) {
  if (row.clase === "ingreso") return `¿Eliminar la categoría de ingreso «${row.name}»? Esta acción no se puede deshacer.`;
  if (row.clase === "sub") return `¿Eliminar la subcategoría «${row.name}»? Esta acción no se puede deshacer.`;
  if (row.subcategoryCount > 0) return `¿Eliminar la categoría de egreso «${row.name}» y sus subcategorías? Esta acción no se puede deshacer.`;
  return `¿Eliminar la categoría de egreso «${row.name}»? Esta acción no se puede deshacer.`;
}

function CatalogEditor({
  row,
  categories,
  q,
  tipo,
}: {
  row: FinanceCatalogSelection;
  categories: FinanceExpenseCatalog[];
  q: string;
  tipo: string;
}) {
  const filters = { q, tipo };
  const form = row.clase === "ingreso" ? (
    <FormPanel action={saveIncomeCategoryAction} className="max-w-none border-0 shadow-none">
      <HiddenFields fields={{ id: row.id, ...filters }} />
      <FormSection title={row.name} description="Categoría de ingreso" columns={1}>
        <Field label="Nombre"><input name="name" required defaultValue={row.name} className={controlClass} /></Field>
      </FormSection>
      <FormActions><Button type="submit">Guardar ingreso</Button></FormActions>
    </FormPanel>
  ) : row.clase === "egreso" ? (
    <FormPanel action={saveExpenseCategoryAction} className="max-w-none border-0 shadow-none">
      <HiddenFields fields={{ id: row.id, ...filters }} />
      <FormSection title={row.name} description="Categoría de egreso. Sus subcategorías están en la lista, debajo de esta fila." columns={1}>
        <Field label="Nombre"><input name="name" required defaultValue={row.name} className={controlClass} /></Field>
      </FormSection>
      <FormActions><Button type="submit">Guardar egreso</Button></FormActions>
    </FormPanel>
  ) : (
    <FormPanel action={saveExpenseSubcategoryAction} className="max-w-none border-0 shadow-none">
      <HiddenFields fields={{ id: row.id, ...filters }} />
      <FormSection title={row.name} description="Subcategoría de egreso" columns={1}>
        <Field label="Categoría">
          <select name="categoryId" defaultValue={row.categoryId} required className={controlClass}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Nombre"><input name="name" required defaultValue={row.name} className={controlClass} /></Field>
      </FormSection>
      <FormActions><Button type="submit">Guardar subcategoría</Button></FormActions>
    </FormPanel>
  );

  return (
    <div className="space-y-3">
      {form}
      <form action={deleteFinanceCatalogAction} className="flex justify-end">
        <HiddenFields fields={{ id: row.id, clase: row.clase, ...filters }} />
        <ConfirmSubmit message={deleteConfirm(row)} pendingLabel="Eliminando…">Eliminar</ConfirmSubmit>
      </form>
    </div>
  );
}
