import { Fragment } from "react";
import { deleteFinanceCatalogAction, saveExpenseCategoryAction, saveExpenseSubcategoryAction, saveIncomeCategoryAction } from "../ceo-actions";
import { ConfirmSubmit } from "@/components/submit-button";
import {
  findFinanceCatalogSelection,
  visibleFinanceCatalog,
  type FinanceCatalogClase,
  type FinanceCatalogSelection,
  type FinanceExpenseCatalog,
  type FinanceIncomeCatalog,
} from "@/lib/finance-catalog-ui";
import { EditorPlaceholder, HiddenFields, MasterDetail, SelectLink, selectedRowClass } from "../pieces";
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

export function CatalogsPanel({
  incomes,
  expenses,
  q,
  tipo,
  selectedId,
  selectedClase,
}: {
  incomes: FinanceIncomeCatalog[];
  expenses: FinanceExpenseCatalog[];
  q: string;
  tipo: string;
  selectedId?: string;
  selectedClase?: string;
}) {
  const clase = tipo === "ingreso" || tipo === "egreso" || tipo === "sub" ? tipo : "";
  const visible = visibleFinanceCatalog({ incomes, expenses, q, tipo: clase });
  const selected = findFinanceCatalogSelection(incomes, expenses, selectedId, selectedClase);
  const hrefFor = (id?: string, rowClase?: string) => listHref("/configuracion/finanzas", {
    vista: "catalogos",
    q: q || undefined,
    tipo: clase || undefined,
    id,
    clase: rowClase,
  });
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
          ...(clase ? [{ label: CLASE_LABEL[clase], clearHref: listHref("/configuracion/finanzas", { vista: "catalogos", q: q || undefined, id: selectedId, clase: selectedClase }) }] : []),
          ...(q ? [{ label: `Búsqueda: ${q}`, clearHref: listHref("/configuracion/finanzas", { vista: "catalogos", tipo: clase || undefined, id: selectedId, clase: selectedClase }) }] : []),
        ]}
      />
      {!hasCatalog ? (
        <Empty title="Sin catálogos" body="Agrega categorías de ingreso o egreso con el botón del encabezado." />
      ) : visible.length === 0 ? (
        <Empty title="Sin coincidencias" body="Ningún concepto coincide con el filtro." />
      ) : (
        <MasterDetail
          list={
            <ResponsiveData
              table={
                <Table stickyHeader>
                  <thead>
                    <tr>
                      <Th>Nombre</Th>
                      <Th>Tipo</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((group) => {
                      if (group.clase === "ingreso") {
                        const isSelected = group.id === selectedId && selectedClase === "ingreso";
                        return (
                          <tr key={`ingreso-${group.id}`} className={selectedRowClass(isSelected)}>
                            <Td><SelectLink href={hrefFor(group.id, "ingreso")} selected={isSelected}>{group.name}</SelectLink></Td>
                            <Td>Ingreso</Td>
                          </tr>
                        );
                      }
                      const categorySelected = group.id === selectedId && selectedClase === "egreso";
                      return (
                        <Fragment key={`egreso-${group.id}`}>
                          <tr className={selectedRowClass(categorySelected)}>
                            <Td><SelectLink href={hrefFor(group.id, "egreso")} selected={categorySelected}>{group.name}</SelectLink></Td>
                            <Td>Egreso</Td>
                          </tr>
                          {group.subcategories.map((subcategory) => {
                            const subSelected = subcategory.id === selectedId && selectedClase === "sub";
                            return (
                              <tr key={`sub-${subcategory.id}`} className={selectedRowClass(subSelected)}>
                                <Td>
                                  <span className="flex items-center gap-2 pl-5">
                                    <span aria-hidden className="text-slate-400">↳</span>
                                    <SelectLink href={hrefFor(subcategory.id, "sub")} selected={subSelected}>
                                      <span className="sr-only">Subcategoría de {group.name}: </span>
                                      {subcategory.name}
                                    </SelectLink>
                                  </span>
                                </Td>
                                <Td>Subcategoría</Td>
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
                  return (
                    <MobileCard key={`ingreso-${group.id}`} href={hrefFor(group.id, "ingreso")} title={group.name} meta="Ingreso" />
                  );
                }
                return (
                  <MobileCard
                    key={`egreso-${group.id}`}
                    href={hrefFor(group.id, "egreso")}
                    title={group.name}
                    meta="Egreso"
                    footer={group.subcategories.length ? (
                      <ul className="space-y-2">
                        {group.subcategories.map((subcategory) => {
                          const subSelected = subcategory.id === selectedId && selectedClase === "sub";
                          return (
                            <li key={subcategory.id} className="border-l border-slate-300 pl-3">
                              <SelectLink href={hrefFor(subcategory.id, "sub")} selected={subSelected}>{subcategory.name}</SelectLink>
                              <p className="text-xs text-slate-500">Subcategoría</p>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  />
                );
              })}
            />
          }
          editor={selected ? (
            <CatalogEditor row={selected} categories={expenses} q={q} tipo={clase} />
          ) : (
            <EditorPlaceholder title="Sin selección" body="Elige un concepto de la lista para editarlo. Las subcategorías están dentro de su categoría de egreso." />
          )}
        />
      )}
    </>
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
    <FormPanel action={saveIncomeCategoryAction} className="max-w-none">
      <HiddenFields fields={{ id: row.id, ...filters }} />
      <FormSection title={row.name} description="Categoría de ingreso" columns={1}>
        <Field label="Nombre"><input name="name" required defaultValue={row.name} className={controlClass} /></Field>
      </FormSection>
      <FormActions><Button type="submit">Guardar ingreso</Button></FormActions>
    </FormPanel>
  ) : row.clase === "egreso" ? (
    <FormPanel action={saveExpenseCategoryAction} className="max-w-none">
      <HiddenFields fields={{ id: row.id, ...filters }} />
      <FormSection title={row.name} description="Categoría de egreso. Sus subcategorías están en la lista, debajo de esta fila." columns={1}>
        <Field label="Nombre"><input name="name" required defaultValue={row.name} className={controlClass} /></Field>
      </FormSection>
      <FormActions><Button type="submit">Guardar egreso</Button></FormActions>
    </FormPanel>
  ) : (
    <FormPanel action={saveExpenseSubcategoryAction} className="max-w-none">
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
