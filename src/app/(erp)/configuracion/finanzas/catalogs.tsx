import { saveExpenseCategoryAction, saveExpenseSubcategoryAction, saveIncomeCategoryAction } from "../ceo-actions";
import { matchesEstado, matchesText, type EstadoFiltro } from "../filters";
import { ActiveSelect, EditorPlaceholder, HiddenFields, MasterDetail, SelectLink, selectedRowClass } from "../pieces";
import {
  ActiveFilters,
  Badge,
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

export type CatalogClase = "ingreso" | "egreso" | "sub";

export type CatalogRow = {
  id: string;
  clase: CatalogClase;
  name: string;
  active: boolean;
  categoryId: string | null;
  categoryName: string | null;
};

const CLASE_LABEL: Record<CatalogClase, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
  sub: "Subcategoría",
};

export function CatalogsPanel({
  rows,
  categories,
  q,
  tipo,
  estado,
  selectedId,
  selectedClase,
}: {
  rows: CatalogRow[];
  categories: Array<{ id: string; name: string }>;
  q: string;
  tipo: string;
  estado: EstadoFiltro;
  selectedId?: string;
  selectedClase?: string;
}) {
  const clase = tipo === "ingreso" || tipo === "egreso" || tipo === "sub" ? tipo : "";
  const visible = rows.filter((row) => {
    if (clase && row.clase !== clase) return false;
    if (!matchesEstado(row.active, estado)) return false;
    return matchesText(q, [row.name, row.categoryName, CLASE_LABEL[row.clase]]);
  });
  const selected = rows.find((row) => row.id === selectedId && row.clase === selectedClase) ?? null;
  const hrefFor = (id?: string, rowClase?: string) => listHref("/configuracion/finanzas", {
    vista: "catalogos",
    q: q || undefined,
    tipo: clase || undefined,
    estado: estado === "todos" ? undefined : estado,
    id,
    clase: rowClase,
  });

  return (
    <>
      <FilterBar action="/configuracion/finanzas">
        <input type="hidden" name="vista" value="catalogos" />
        <input name="q" defaultValue={q} placeholder="Nombre o categoría" className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} />
        <select name="tipo" defaultValue={clase} className={`${controlClass} sm:w-auto`}>
          <option value="">Todos</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
          <option value="sub">Subcategorías</option>
        </select>
        <select name="estado" defaultValue={estado === "todos" ? "" : estado} className={`${controlClass} sm:w-auto`}>
          <option value="">Todas</option>
          <option value="activos">Activas</option>
          <option value="inactivos">Inactivas</option>
        </select>
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(clase ? [{ label: CLASE_LABEL[clase], clearHref: listHref("/configuracion/finanzas", { vista: "catalogos", q: q || undefined, estado: estado === "todos" ? undefined : estado, id: selectedId, clase: selectedClase }) }] : []),
          ...(estado !== "todos" ? [{ label: estado === "activos" ? "Activas" : "Inactivas", clearHref: listHref("/configuracion/finanzas", { vista: "catalogos", q: q || undefined, tipo: clase || undefined, id: selectedId, clase: selectedClase }) }] : []),
          ...(q ? [{ label: `Búsqueda: ${q}`, clearHref: listHref("/configuracion/finanzas", { vista: "catalogos", tipo: clase || undefined, estado: estado === "todos" ? undefined : estado, id: selectedId, clase: selectedClase }) }] : []),
        ]}
      />
      {rows.length === 0 ? (
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
                      <Th>Categoría</Th>
                      <Th>Estado</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((row) => {
                      const selected = row.id === selectedId && row.clase === selectedClase;
                      return (
                        <tr key={`${row.clase}-${row.id}`} className={selectedRowClass(selected)}>
                          <Td><SelectLink href={hrefFor(row.id, row.clase)} selected={selected}>{row.name}</SelectLink></Td>
                          <Td>{CLASE_LABEL[row.clase]}</Td>
                          <Td>{row.categoryName ?? "—"}</Td>
                          <Td><Badge tone={row.active ? "ok" : "neutral"}>{row.active ? "Activa" : "Inactiva"}</Badge></Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              }
              cards={visible.map((row) => (
                <MobileCard
                  key={`${row.clase}-${row.id}`}
                  href={hrefFor(row.id, row.clase)}
                  title={row.name}
                  meta={<Badge tone={row.active ? "ok" : "neutral"}>{row.active ? "Activa" : "Inactiva"}</Badge>}
                >
                  <p>{CLASE_LABEL[row.clase]}</p>
                  <p className="mt-1">Categoría: {row.categoryName ?? "—"}</p>
                </MobileCard>
              ))}
            />
          }
          editor={selected ? (
            <CatalogEditor row={selected} categories={categories} q={q} tipo={clase} estado={estado} />
          ) : (
            <EditorPlaceholder title="Sin selección" body="Elige un concepto de la lista para editarlo. Las subcategorías se editan en esta misma lista." />
          )}
        />
      )}
    </>
  );
}

function CatalogEditor({
  row,
  categories,
  q,
  tipo,
  estado,
}: {
  row: CatalogRow;
  categories: Array<{ id: string; name: string }>;
  q: string;
  tipo: string;
  estado: EstadoFiltro;
}) {
  const filters = {
    q,
    tipo,
    estado: estado === "todos" ? undefined : estado,
  };
  if (row.clase === "ingreso") {
    return (
      <FormPanel action={saveIncomeCategoryAction} className="max-w-none">
        <HiddenFields fields={{ id: row.id, ...filters }} />
        <FormSection title={row.name} description="Categoría de ingreso" columns={1}>
          <Field label="Nombre"><input name="name" required defaultValue={row.name} className={controlClass} /></Field>
          <Field label="Estado"><ActiveSelect active={row.active} /></Field>
        </FormSection>
        <FormActions><Button type="submit">Guardar ingreso</Button></FormActions>
      </FormPanel>
    );
  }
  if (row.clase === "egreso") {
    return (
      <FormPanel action={saveExpenseCategoryAction} className="max-w-none">
        <HiddenFields fields={{ id: row.id, ...filters }} />
        <FormSection title={row.name} description="Categoría de egreso" columns={1}>
          <Field label="Nombre"><input name="name" required defaultValue={row.name} className={controlClass} /></Field>
          <Field label="Estado"><ActiveSelect active={row.active} /></Field>
        </FormSection>
        <FormActions><Button type="submit">Guardar egreso</Button></FormActions>
      </FormPanel>
    );
  }
  return (
    <FormPanel action={saveExpenseSubcategoryAction} className="max-w-none">
      <HiddenFields fields={{ id: row.id, ...filters }} />
      <FormSection title={row.name} description="Subcategoría de egreso" columns={1}>
        <Field label="Categoría">
          <select name="categoryId" defaultValue={row.categoryId ?? ""} required className={controlClass}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Nombre"><input name="name" required defaultValue={row.name} className={controlClass} /></Field>
        <Field label="Estado"><ActiveSelect active={row.active} /></Field>
      </FormSection>
      <FormActions><Button type="submit">Guardar subcategoría</Button></FormActions>
    </FormPanel>
  );
}
