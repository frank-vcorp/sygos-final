import { saveActivityTypeAction } from "../ceo-actions";
import { CreateDialog } from "../create-dialog";
import { matchesEstado, matchesText, readEstado } from "../filters";
import { requireCeoConfig } from "../guard";
import { ActiveSelect, HiddenFields } from "../pieces";
import { ActividadesPanel } from "./actividades-panel";
import {
  ActiveFilters,
  Button,
  controlClass,
  Empty,
  Field,
  FilterBar,
  FormActions,
  FormSection,
  PageHeader,
} from "@/components/ui";
import { prisma } from "@/lib/db";
import { listHref } from "@/lib/list-url";

export default async function ActividadesComercialesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>;
}) {
  const session = await requireCeoConfig();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const estado = readEstado(sp.estado);
  const activities = await prisma.agendaCategory.findMany({
    where: { companyId: session.activeCompanyId },
    orderBy: { name: "asc" },
  });
  const visible = activities.filter((activity) => matchesEstado(activity.active, estado) && matchesText(q, [activity.name]));
  const filters = { q, estado: estado === "todos" ? undefined : estado };

  return (
    <>
      <PageHeader
        back={{ href: "/configuracion", label: "Configuración" }}
        title="Comercial"
        subtitle={`${session.activeCompanyName} · Actividades que ya usa la agenda.`}
        action={
          <CreateDialog label="Nueva actividad" title="Nueva actividad" titleId="nueva-actividad">
            <form action={saveActivityTypeAction}>
              <HiddenFields fields={filters} />
              <FormSection title="Tipo de actividad" columns={1}>
                <Field label="Nombre"><input name="name" required autoFocus className={controlClass} /></Field>
                <Field label="Estado"><ActiveSelect /></Field>
              </FormSection>
              <FormActions><Button type="submit">Crear actividad</Button></FormActions>
            </form>
          </CreateDialog>
        }
      />
      <FilterBar action="/configuracion/actividades">
        <input name="q" defaultValue={q} placeholder="Nombre" className={`${controlClass} sm:min-w-[12rem] sm:flex-1`} />
        <select name="estado" defaultValue={estado === "todos" ? "" : estado} className={`${controlClass} sm:w-auto`}>
          <option value="">Todas</option>
          <option value="activos">Activas</option>
          <option value="inactivos">Inactivas</option>
        </select>
        <Button type="submit" tone="ghost">Buscar</Button>
      </FilterBar>
      <ActiveFilters
        items={[
          ...(estado !== "todos" ? [{ label: estado === "activos" ? "Activas" : "Inactivas", clearHref: listHref("/configuracion/actividades", { q: q || undefined }) }] : []),
          ...(q ? [{ label: `Búsqueda: ${q}`, clearHref: listHref("/configuracion/actividades", { estado: estado === "todos" ? undefined : estado }) }] : []),
        ]}
      />
      {activities.length === 0 ? (
        <Empty title="Sin actividades" body="Crea el primer tipo con el botón del encabezado." />
      ) : visible.length === 0 ? (
        <Empty title="Sin coincidencias" body="Ninguna actividad coincide con el filtro." />
      ) : (
        <ActividadesPanel activities={visible} filters={filters} />
      )}
    </>
  );
}
